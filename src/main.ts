import * as fs from 'fs';
import * as core from '@actions/core';
import * as github from '@actions/github';
import * as path from 'path';

const glob = require("glob")

async function get_release_by_tag(tag: string, octokit: any, context: any, draft: boolean): Promise<any> {
    try {
        core.debug(`Getting release by tag ${tag}.`);
        return await octokit.repos.getReleaseByTag({
            ...context.repo,
            tag: tag,
        });
    } catch (error) {
        // If this returns 404, we need to create the release first.
        if (error.status === 404) {
            // if there is a draft release already, use that 
            if (draft) {
                const releases = await octokit.repos.listReleases({
                    ...context.repo,
                });
                core.debug(`Found ${releases.data.length} releases, looking for draft release to piggyback..`)
                for (let i = 0; i < releases.data.length; i += 1) {
                    const release = releases.data[i];
                    if (release.draft) {
                        core.debug(JSON.stringify(release));
                        core.debug(`Found draft release in repo, tag_name: ${release.tag_name}`)
                        return { data: release };
                    }
                }
            }
            // otherwise create a release (draft if necessary)
            core.debug(`Release for tag ${tag} doesn't exist yet so we'll create it now.`)
            return await octokit.repos.createRelease({
                ...context.repo,
                tag_name: tag,
                draft,
            })
        } else {
            throw error;
        }
    }
}

async function upload_to_release(release: any, file: string, asset_name: string, tag: string, overwrite: string, octokit: any, context: any) {
    const stat = fs.statSync(file);
    if (!stat.isFile()) {
        core.debug(`Skipping ${file}, since its not a file`);
        return;
    }
    const file_size = stat.size;
    const file_bytes = fs.readFileSync(file);

    // Check for duplicates.
    const assets = await octokit.repos.listAssetsForRelease({
        ...context.repo,
        release_id: release.data.id,
    });
    const duplicate_asset = assets.data.find(a => a.name === asset_name);
    if (duplicate_asset !== undefined) {
        if (overwrite === "true") {
            core.debug(`An asset called ${asset_name} already exists in release ${tag} so we'll overwrite it.`)
            await octokit.repos.deleteReleaseAsset({
                ...context.repo,
                asset_id: duplicate_asset.id
            })
        } else {
            core.setFailed(`An asset called ${asset_name} already exists.`)
            return;
        }
    } else {
        core.debug(`No pre-existing asset called ${asset_name} found in release ${tag}. All good.`);
    }

    core.debug(`Uploading ${file} to ${asset_name} in release ${tag}.`)
    await octokit.repos.uploadReleaseAsset({
        url: release.data.upload_url,
        name: asset_name,
        file: file_bytes,
        headers: {
            "content-type": "binary/octet-stream",
            "content-length": file_size
        },
    });
}

async function run() {
    try {
        const token = core.getInput('repo_token', { required: true });
        const file = core.getInput('file', { required: true });
        const file_glob = core.getInput('file_glob');
        const tag = core.getInput('tag', { required: true }).replace("refs/tags/", "");
        const overwrite = core.getInput('overwrite');
        const draft = core.getInput('draft');

        const octokit = new github.GitHub(token);
        const context = github.context;
        const release = await get_release_by_tag(tag, octokit, context, draft === "true");

        if (file_glob === "true") {
            const files = glob.sync(file);
            if (files.length > 0) {
                for (let i = 0; i < files.length; i += 1) {
                    const item = files[i];
                    const asset_name = path.basename(item);
                    await upload_to_release(release, item, asset_name, tag, overwrite, octokit, context);
                }
            }
            else {
                core.setFailed("No files matching the glob pattern found.");
            }
        }
        else {
            const asset_name = core.getInput('asset_name', { required: true });
            await upload_to_release(release, file, asset_name, tag, overwrite, octokit, context);
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
