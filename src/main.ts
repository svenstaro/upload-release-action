import * as fs from 'fs'
import {Octokit} from '@octokit/core'
import {Endpoints} from '@octokit/types'
import * as core from '@actions/core'
import * as github from '@actions/github'
import * as path from 'path'
import * as glob from 'glob'

const releaseByTag = 'GET /repos/{owner}/{repo}/releases/tags/{tag}' as const
const createRelease = 'POST /repos/{owner}/{repo}/releases' as const
const repoAssets =
  'GET /repos/{owner}/{repo}/releases/{release_id}/assets' as const
const uploadAssets =
  'POST {origin}/repos/{owner}/{repo}/releases/{release_id}/assets{?name,label}' as const
const deleteAssets =
  'DELETE /repos/{owner}/{repo}/releases/assets/{asset_id}' as const

type ReleaseByTagResp = Endpoints[typeof releaseByTag]['response']
type CreateReleaseResp = Endpoints[typeof createRelease]['response']
type RepoAssetsResp = Endpoints[typeof repoAssets]['response']['data']
type UploadAssetResp = Endpoints[typeof uploadAssets]['response']

async function get_release_by_tag(
  tag: string,
  prerelease: boolean,
  release_name: string,
  body: string,
  octokit: Octokit
): Promise<ReleaseByTagResp | CreateReleaseResp> {
  try {
    core.debug(`Getting release by tag ${tag}.`)
    return await octokit.request(releaseByTag, {
      ...repo(),
      tag: tag
    })
  } catch (error: any) {
    // If this returns 404, we need to create the release first.
    if (error.status === 404) {
      core.debug(
        `Release for tag ${tag} doesn't exist yet so we'll create it now.`
      )
      return await octokit.request(createRelease, {
        ...repo(),
        tag_name: tag,
        prerelease: prerelease,
        name: release_name,
        body: body
      })
    } else {
      throw error
    }
  }
}

async function upload_to_release(
  release: ReleaseByTagResp | CreateReleaseResp,
  file: string,
  asset_name: string,
  tag: string,
  overwrite: boolean,
  octokit: ReturnType<(typeof github)['getOctokit']>
): Promise<undefined | string> {
  const stat = fs.statSync(file)
  if (!stat.isFile()) {
    core.debug(`Skipping ${file}, since its not a file`)
    return
  }
  const file_size = stat.size
  const file_bytes: any = fs.createReadStream(file)

  // Check for duplicates.
  const assets: RepoAssetsResp = await octokit.paginate(repoAssets, {
    ...repo(),
    release_id: release.data.id
  })
  const duplicate_asset = assets.find(a => a.name === asset_name)
  if (duplicate_asset !== undefined) {
    if (overwrite) {
      core.debug(
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

  core.debug(`Uploading ${file} to ${asset_name} in release ${tag}.`)
  const uploaded_asset: UploadAssetResp = await octokit.request(uploadAssets, {
    ...repo(),
    release_id: release.data.id,
    url: release.data.upload_url,
    name: asset_name,
    data: file_bytes,
    headers: {
      'content-type': 'binary/octet-stream',
      'content-length': file_size
    }
  })
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

    const file_glob = core.getInput('file_glob') == 'true' ? true : false
    const overwrite = core.getInput('overwrite') == 'true' ? true : false
    const prerelease = core.getInput('prerelease') == 'true' ? true : false
    const release_name = core.getInput('release_name')
    const body = core
      .getInput('body')
      .replace(/%0A/gi, '\n')
      .replace(/%0D/gi, '\r')
      .replace(/%25/g, '%')

    const octokit = github.getOctokit(token)
    const release = await get_release_by_tag(
      tag,
      prerelease,
      release_name,
      body,
      octokit
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
            octokit
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
        octokit
      )
      core.setOutput('browser_download_url', asset_download_url)
    }
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

run()
