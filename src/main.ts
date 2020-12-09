import * as fs from 'fs'
import {Octokit} from '@octokit/core'
import {
  Endpoints,
  ReposGetReleaseByTagResponseData,
  ReposListReleasesResponseData
} from '@octokit/types'
import * as core from '@actions/core'
import * as github from '@actions/github'
import * as path from 'path'
import * as glob from 'glob'

type GetReleaseByTagResp = Endpoints['GET /repos/:owner/:repo/releases/tags/:tag']['response']
type ListReleasesResp = Endpoints['GET /repos/:owner/:repo/releases']['response']
type RepoAssetsResp = Endpoints['GET /repos/:owner/:repo/releases/:release_id/assets']['response']
type UploadAssetResp = Endpoints['POST /repos/:owner/:repo/releases/:release_id/assets{?name,label}']['response']
type ReleaseData =
  | ReposGetReleaseByTagResponseData
  | ReposListReleasesResponseData[0]
async function get_release_by_tag(
  tag: string,
  octokit: Octokit
): Promise<ReleaseData> {
  try {
    core.info(`Getting release by tag ${tag}`)
    const resp: GetReleaseByTagResp = await octokit.repos.getReleaseByTag({
      ...repo(),
      tag: tag
    })
    core.debug(`response from get release by tag: ${JSON.stringify(resp)}`)
    return resp.data
  } catch (error) {
    if (error.status !== 404) {
      core.info(`Failed to get release by tag. Not a 404 error. Throwing.`)
      throw error
    }
  }

  // If we get a 404, we need to check the release drafts.

  try {
    core.info(
      'Failed to get release by tag. Checking to see if a release draft with the tag exists.'
    )
    const resp: ListReleasesResp = await octokit.repos.listReleases(repo())
    core.debug(`response from listing releases: ${JSON.stringify(resp)}`)
    let found = false
    let draftRelease = resp.data[0]
    for (const release of resp.data) {
      if (release.tag_name === tag) {
        draftRelease = release
        found = true
        break
      }
    }
    if (found) {
      core.info('Found release draft with the given tag.')
      return draftRelease
    }
  } catch (error) {
    core.info(`Failed to list the releases. Throwing.`)
    throw error
  }

  throw new Error(`No release or release draft found with the tag ${tag}`)
}

async function upload_to_release(
  releaseData: ReleaseData,
  file: string,
  asset_name: string,
  tag: string,
  overwrite: boolean,
  octokit: Octokit
): Promise<string> {
  const stat = fs.statSync(file)
  if (!stat.isFile()) {
    core.info(`Skipping ${file} since it is not a file.`)
    return ''
  }
  const file_size = stat.size
  const file_bytes = fs.readFileSync(file)

  // Check for duplicates.
  const assets: RepoAssetsResp = await octokit.repos.listReleaseAssets({
    ...repo(),
    release_id: releaseData.id
  })
  const duplicate_asset = assets.data.find(a => a.name === asset_name)
  if (duplicate_asset !== undefined) {
    if (overwrite) {
      core.info(
        `Overwriting since an asset called ${asset_name} already exists in release ${tag}`
      )
      await octokit.repos.deleteReleaseAsset({
        ...repo(),
        asset_id: duplicate_asset.id
      })
    } else {
      core.setFailed(
        `Overwrite is set to false and an asset called ${asset_name} already exists in release ${tag}`
      )
      return duplicate_asset.browser_download_url
    }
  } else {
    core.info(`Release ${tag} has no pre-existing asset called ${asset_name}`)
  }

  core.info(`Uploading ${file} to ${asset_name} in release ${tag}`)
  const uploaded_asset: UploadAssetResp = await octokit.repos.uploadReleaseAsset(
    {
      url: releaseData.upload_url,
      name: asset_name,
      data: file_bytes,
      headers: {
        'content-type': 'binary/octet-stream',
        'content-length': file_size
      }
    }
  )
  return uploaded_asset.data.browser_download_url
}

function repo(): {owner: string; repo: string} {
  const repo_name = core.getInput('repo_name')
  // If we're not targeting a foreign repository, we can just return immediately and don't have to do extra work.
  if (repo_name === '') {
    return github.context.repo
  }
  const owner = repo_name.substr(0, repo_name.indexOf('/'))
  if (!owner) {
    throw new Error(`Could not extract 'owner' from 'repo_name': ${repo_name}`)
  }
  const repo = repo_name.substr(repo_name.indexOf('/') + 1)
  if (!repo) {
    throw new Error(`Could not extract 'repo' from 'repo_name': ${repo_name}`)
  }
  return {owner, repo}
}

async function run(): Promise<void> {
  try {
    // Get the inputs from the workflow file: https://github.com/actions/toolkit/tree/master/packages/core#inputsoutputs
    const token = core.getInput('repo_token', {required: true})
    const tag = core
      .getInput('tag', {required: true})
      .replace('refs/tags/', '')
      .replace('refs/heads/', '')
    const file = core.getInput('file', {required: true})
    const file_glob = core.getInput('file_glob') === 'true'
    const asset_name =
      core.getInput('asset_name') === ''
        ? path.basename(file)
        : core.getInput('asset_name').replace(/\$tag/g, tag)
    const overwrite = core.getInput('overwrite') === 'true'

    const octokit: Octokit = github.getOctokit(token)
    const release = await get_release_by_tag(tag, octokit)

    if (file_glob) {
      const files = glob.sync(file)
      if (files.length > 0) {
        for (const file of files) {
          const asset_name = path.basename(file)
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
      } else {
        core.setFailed('No files matching the glob pattern found.')
      }
    } else {
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
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
