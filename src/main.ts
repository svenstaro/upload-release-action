import * as fs from 'fs'
import {Octokit} from '@octokit/core'
import {Endpoints} from '@octokit/types'
import * as core from '@actions/core'
import * as github from '@actions/github'
import * as path from 'path'
import * as glob from 'glob'
import {retry} from '@lifeomic/attempt'

const getRef = 'GET /repos/{owner}/{repo}/git/ref/{ref}'
const releaseByTag = 'GET /repos/{owner}/{repo}/releases/tags/{tag}'
const releaseByID = 'GET /repos/{owner}/{repo}/releases/{release_id}'
const createRelease = 'POST /repos/{owner}/{repo}/releases'
const updateRelease = 'PATCH /repos/{owner}/{repo}/releases/{release_id}'
const repoAssets = 'GET /repos/{owner}/{repo}/releases/{release_id}/assets'
const uploadAssets =
  'POST {origin}/repos/{owner}/{repo}/releases/{release_id}/assets{?name,label}'
const deleteAssets = 'DELETE /repos/{owner}/{repo}/releases/assets/{asset_id}'

type ReleaseByTagResp = Endpoints[typeof releaseByTag]['response']
type ReleaseByIDResp = Endpoints[typeof releaseByID]['response']
type CreateReleaseResp = Endpoints[typeof createRelease]['response']
type RepoAssetsResp = Endpoints[typeof repoAssets]['response']['data']
type UploadAssetResp = Endpoints[typeof uploadAssets]['response']
type UpdateReleaseResp = Endpoints[typeof updateRelease]['response']
type UpdateReleaseParams = Endpoints[typeof updateRelease]['parameters']

async function get_release_by_tag(
  tag: string,
  draft: boolean,
  prerelease: boolean,
  make_latest: boolean,
  release_name: string,
  body: string,
  octokit: Octokit,
  overwrite: boolean,
  promote: boolean,
  target_commit: string,
  known_draft_id = 0
): Promise<ReleaseByTagResp | CreateReleaseResp | UpdateReleaseResp> {
  let release: ReleaseByTagResp | ReleaseByIDResp
  try {
    core.info(`Draft ID: ${known_draft_id}`)

    if (draft && known_draft_id !== 0) {
      // We are working with a draft release and we already created it
      core.info(
        `Getting release by id ${known_draft_id} because we're working with a draft release.`
      )
      release = await octokit.request(releaseByID, {
        ...repo(),
        release_id: known_draft_id
      })

      core.debug(`The release has the following ID: ${release.data.id}`)
    } else {
      core.info(`Getting release by tag ${tag}.`)
      // @ts-ignore
      release = await octokit.request(releaseByTag, {
        ...repo(),
        tag: tag
      })
    }
  } catch (error: any) {
    // If this returns 404, we need to create the release first.
    if (error.status !== 404) throw error

    core.info(
      `Release for tag ${tag} doesn't exist yet so we'll create it now.`
    )
    if (target_commit) {
      try {
        await octokit.request(getRef, {
          ...repo(),
          ref: `tags/${tag}`
        })
        core.warning(`Ignoring target_commit as the tag ${tag} already exists`)
      } catch (tagError: any) {
        if (tagError.status !== 404) throw tagError
      }
    }
    // @ts-ignore
    const _release = await octokit.request(createRelease, {
      ...repo(),
      tag_name: tag,
      draft: draft,
      prerelease: prerelease,
      make_latest: make_latest ? 'true' : 'false',
      name: release_name,
      body: body,
      target_commitish: target_commit
    })
    core.setOutput('draft_id', _release.data.id)
    return _release
  }

  return await update_release(
    promote,
    release,
    tag,
    overwrite,
    release_name,
    body,
    octokit
  )
}

async function update_release(
  promote: boolean,
  release: ReleaseByTagResp | ReleaseByIDResp,
  tag: string,
  overwrite: boolean,
  release_name: string,
  body: string,
  octokit: Octokit
): Promise<ReleaseByTagResp | UpdateReleaseResp> {
  let updateObject: Partial<UpdateReleaseParams> | undefined

  if (promote && release.data.prerelease) {
    core.info(`The ${tag} is a prerelease, promoting it to a release.`)
    updateObject = updateObject || {}
    updateObject.prerelease = false
  }

  if (overwrite) {
    if (release_name && release.data.name !== release_name) {
      core.info(
        `The ${tag} release already exists with a different name ${release.data.name} so we'll overwrite it.`
      )
      updateObject = updateObject || {}
      updateObject.name = release_name
    }
    if (body && release.data.body !== body) {
      core.info(
        `The ${tag} release already exists with a different body ${release.data.body} so we'll overwrite it.`
      )
      updateObject = updateObject || {}
      updateObject.body = body
    }
  }

  if (updateObject) {
    // @ts-ignore
    return await octokit.request(updateRelease, {
      ...repo(),
      ...updateObject,
      release_id: release.data.id
    })
  }
  return release
}

async function upload_to_release(
  release: ReleaseByTagResp | CreateReleaseResp | UpdateReleaseResp,
  file: string,
  asset_name: string,
  tag: string,
  overwrite: boolean,
  octokit: ReturnType<(typeof github)['getOctokit']>,
  check_duplicates: boolean
): Promise<undefined | string> {
  const stat = fs.statSync(file)
  if (!stat.isFile()) {
    core.warning(`Skipping ${file}, since its not a file`)
    return
  }
  const file_size = stat.size
  if (file_size === 0) {
    core.warning(`Skipping ${file}, since its size is 0`)
    return
  }

  if (check_duplicates) {
    // Check for duplicates.
    const assets: RepoAssetsResp = await octokit.paginate(repoAssets, {
      ...repo(),
      release_id: release.data.id
    })
    const duplicate_asset = assets.find(a => a.name === asset_name)
    if (duplicate_asset !== undefined) {
      if (overwrite) {
        core.info(
          `An asset called ${asset_name} already exists in release ${tag} so we'll overwrite it.`
        )
        await octokit.request(deleteAssets, {
          ...repo(),
          asset_id: duplicate_asset.id
        })
      } else {
        core.setFailed(`An asset called ${asset_name} already exists.`)
        return duplicate_asset.browser_download_url
      }
    } else {
      core.debug(
        `No pre-existing asset called ${asset_name} found in release ${tag}. All good.`
      )
    }
  }

  core.info(`Uploading ${file} to ${asset_name} in release ${tag}.`)

  // @ts-ignore
  const uploaded_asset: UploadAssetResp = await retry(
    async () => {
      return octokit.request(uploadAssets, {
        ...repo(),
        release_id: release.data.id,
        url: release.data.upload_url,
        name: asset_name,
        data: fs.createReadStream(file) as any,
        headers: {
          'content-type': 'binary/octet-stream',
          'content-length': file_size
        }
      })
    },
    {
      maxAttempts: 3
    }
  )
  return uploaded_asset.data.browser_download_url
}

function repo(): {owner: string; repo: string} {
  const repo_name = core.getInput('repo_name')
  // If we're not targeting a foreign repository, we can just return immediately and don't have to do extra work.
  if (!repo_name) {
    return github.context.repo
  }
  const owner = repo_name.substring(0, repo_name.indexOf('/'))
  if (!owner) {
    throw new Error(`Could not extract 'owner' from 'repo_name': ${repo_name}.`)
  }
  const repo_ = repo_name.substring(repo_name.indexOf('/') + 1)
  if (!repo_) {
    throw new Error(`Could not extract 'repo' from 'repo_name': ${repo_name}.`)
  }
  return {
    owner,
    repo: repo_
  }
}

async function run(): Promise<void> {
  try {
    // Get the inputs from the workflow file: https://github.com/actions/toolkit/tree/master/packages/core#inputsoutputs
    const token = core.getInput('repo_token', {required: true})
    const file = core.getInput('file', {required: true})
    const tag = core
      .getInput('tag', {required: true})
      .replace('refs/tags/', '')
      .replace('refs/heads/', '')

    const file_glob = core.getInput('file_glob') == 'true'
    const overwrite = core.getInput('overwrite') == 'true'
    const promote = core.getInput('promote') == 'true'
    const draft = core.getInput('draft') == 'true'
    const prerelease = core.getInput('prerelease') == 'true'
    const make_latest = core.getInput('make_latest') != 'false'
    const release_name = core.getInput('release_name')
    const target_commit = core.getInput('target_commit')
    const draft_release_id = core.getInput('draft_id')
    const check_duplicates =
      core.getInput('check_duplicates') != 'false' ? true : false
    const body = core
      .getInput('body')
      .replace(/%0A/gi, '\n')
      .replace(/%0D/gi, '\r')
      .replace(/%25/g, '%')

    const octokit = github.getOctokit(token)
    const release = await get_release_by_tag(
      tag,
      draft,
      prerelease,
      make_latest,
      release_name,
      body,
      octokit,
      overwrite,
      promote,
      target_commit,
      Number(draft_release_id)
    )

    if (file_glob) {
      const files = glob.sync(file)
      if (files.length > 0) {
        for (const file_ of files) {
          const asset_name = path.basename(file_)
          const asset_download_url = await upload_to_release(
            release,
            file_,
            asset_name,
            tag,
            overwrite,
            octokit,
            check_duplicates
          )
          core.setOutput('browser_download_url', asset_download_url)
        }
      } else {
        core.setFailed('No files matching the glob pattern found.')
      }
    } else {
      const asset_name =
        core.getInput('asset_name') !== ''
          ? core.getInput('asset_name').replace(/\$tag/g, tag)
          : path.basename(file)
      const asset_download_url = await upload_to_release(
        release,
        file,
        asset_name,
        tag,
        overwrite,
        octokit,
        check_duplicates
      )
      core.setOutput('browser_download_url', asset_download_url)
    }
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

run()
