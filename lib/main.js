"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const path = __importStar(require("path"));
const glob = require("glob");
function get_release_by_tag(tag, octokit, context, draft) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            core.debug(`Getting release by tag ${tag}.`);
            return yield octokit.repos.getReleaseByTag(Object.assign({}, context.repo, { tag: tag }));
        }
        catch (error) {
            // If this returns 404, we need to create the release first.
            if (error.status === 404) {
                // if there is a draft release already, use that 
                if (draft) {
                    const releases = yield octokit.repos.listReleases(Object.assign({}, context.repo));
                    core.debug(`Found ${releases.data.length} releases, looking for draft release to piggyback..`);
                    for (let i = 0; i < releases.data.length; i += 1) {
                        const release = releases.data[i];
                        if (release.draft) {
                            core.debug(JSON.stringify(release));
                            core.debug(`Found draft release in repo, tag_name: ${release.tag_name}`);
                            return { data: release };
                        }
                    }
                }
                // otherwise create a release (draft if necessary)
                core.debug(`Release for tag ${tag} doesn't exist yet so we'll create it now.`);
                return yield octokit.repos.createRelease(Object.assign({}, context.repo, { tag_name: tag, draft }));
            }
            else {
                throw error;
            }
        }
    });
}
function upload_to_release(release, file, asset_name, tag, overwrite, octokit, context) {
    return __awaiter(this, void 0, void 0, function* () {
        const stat = fs.statSync(file);
        if (!stat.isFile()) {
            core.debug(`Skipping ${file}, since its not a file`);
            return;
        }
        const file_size = stat.size;
        const file_bytes = fs.readFileSync(file);
        // Check for duplicates.
        const assets = yield octokit.repos.listAssetsForRelease(Object.assign({}, context.repo, { release_id: release.data.id }));
        const duplicate_asset = assets.data.find(a => a.name === asset_name);
        if (duplicate_asset !== undefined) {
            if (overwrite === "true") {
                core.debug(`An asset called ${asset_name} already exists in release ${tag} so we'll overwrite it.`);
                yield octokit.repos.deleteReleaseAsset(Object.assign({}, context.repo, { asset_id: duplicate_asset.id }));
            }
            else {
                core.setFailed(`An asset called ${asset_name} already exists.`);
                return;
            }
        }
        else {
            core.debug(`No pre-existing asset called ${asset_name} found in release ${tag}. All good.`);
        }
        core.debug(`Uploading ${file} to ${asset_name} in release ${tag}.`);
        yield octokit.repos.uploadReleaseAsset({
            url: release.data.upload_url,
            name: asset_name,
            file: file_bytes,
            headers: {
                "content-type": "binary/octet-stream",
                "content-length": file_size
            },
        });
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const token = core.getInput('repo_token', { required: true });
            const file = core.getInput('file', { required: true });
            const file_glob = core.getInput('file_glob');
            const tag = core.getInput('tag', { required: true }).replace("refs/tags/", "");
            const overwrite = core.getInput('overwrite');
            const draft = core.getInput('draft');
            const octokit = new github.GitHub(token);
            const context = github.context;
            const release = yield get_release_by_tag(tag, octokit, context, draft === "true");
            if (file_glob === "true") {
                const files = glob.sync(file);
                if (files.length > 0) {
                    for (let i = 0; i < files.length; i += 1) {
                        const item = files[i];
                        const asset_name = path.basename(item);
                        yield upload_to_release(release, item, asset_name, tag, overwrite, octokit, context);
                    }
                }
                else {
                    core.setFailed("No files matching the glob pattern found.");
                }
            }
            else {
                const asset_name = core.getInput('asset_name', { required: true });
                yield upload_to_release(release, file, asset_name, tag, overwrite, octokit, context);
            }
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
