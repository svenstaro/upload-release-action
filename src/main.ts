import * as fs from 'fs'
import {Octokit} from '@octokit/core'
import {Endpoints} from '@octokit/types'
import * as core from '@actions/core'
import * as github from '@actions/github'
import * as path from 'path'
import * as glob from 'glob'

type RepoAssetsResp = Endpoints['GET /repos/:owner/:repo/releases/:release_id/assets']['response']
type ReleaseByTagResp = Endpoints['GET /repos/:owner/:repo/releases/tags/:tag']['response']
type CreateReleaseResp = Endpoints['POST /repos/:owner/:repo/releases']['response']

async function get_release_by_tag(
  tag: string,
  octokit: Octokit
): Promise<ReleaseByTagResp | CreateReleaseResp> {
  try {
    core.debug(`Getting release by tag ${tag}.`)
    return await octokit.repos.getReleaseByTag({
      ...github.context.repo,
      tag: tag
    })
  } catch (error) {
    // If this returns 404, we need to create the release first.
    if (error.status === 404) {
      core.debug(
        `Release for tag ${tag} doesn't exist yet so we'll create it now.`
      )
      return await octokit.repos.createRelease({
        ...github.context.repo,
        tag_name: tag,
        draft: false,
        prerelease: true
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
  overwrite: string,
  octokit: Octokit
): Promise<void> {
  const stat = fs.statSync(file)
  if (!stat.isFile()) {
    core.debug(`Skipping ${file}, since its not a file`)
    return
  }
  const file_bytes = fs.readFileSync(file)

  // Check for duplicates.
  const assets: RepoAssetsResp = await octokit.repos.listReleaseAssets({
    ...github.context.repo,
    release_id: release.data.id
  })
  const duplicate_asset = assets.data.find(a => a.name === asset_name)
  if (duplicate_asset !== undefined) {
    if (overwrite === 'true') {
      core.debug(
        `An asset called ${asset_name} already exists in release ${tag} so we'll overwrite it.`
      )
      await octokit.repos.deleteReleaseAsset({
        ...github.context.repo,
        asset_id: duplicate_asset.id
      })
    } else {
      core.setFailed(`An asset called ${asset_name} already exists.`)
      return
    }
  } else {
    core.debug(
      `No pre-existing asset called ${asset_name} found in release ${tag}. All good.`
    )
  }

  core.debug(`Uploading ${file} to ${asset_name} in release ${tag}.`)
  await octokit.repos.uploadReleaseAsset({
    ...github.context.repo,
    release_id: release.data.id,
    data: file_bytes
  })
}

async function run(): Promise<void> {
  try {
    const token = core.getInput('repo_token', {required: true})
    const file = core.getInput('file', {required: true})
    const file_glob = core.getInput('file_glob')
    const tag = core.getInput('tag', {required: true}).replace('refs/tags/', '')
    const overwrite = core.getInput('overwrite')

    const octokit: Octokit = github.getOctokit(token)
    const release = await get_release_by_tag(tag, octokit)

    if (file_glob === 'true') {
      const files = glob.sync(file)
      if (files.length > 0) {
        for (const file of files) {
          const asset_name = path.basename(file)
          await upload_to_release(
            release,
            file,
            asset_name,
            tag,
            overwrite,
            octokit
          )
        }
      } else {
        core.setFailed('No files matching the glob pattern found.')
      }
    } else {
      const asset_name = core
        .getInput('asset_name', {required: true})
        .replace(/\$tag/g, tag)
      await upload_to_release(
        release,
        file,
        asset_name,
        tag,
        overwrite,
        octokit
      )
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
