# Upload files to a GitHub release [![GitHub Actions Workflow](https://github.com/svenstaro/upload-release-action/actions/workflows/ci.yml/badge.svg)](https://github.com/svenstaro/upload-release-action/actions)

This action allows you to select which files to upload to the just-tagged release.
It runs on all operating systems types offered by GitHub.

## Input variables

You must provide:

- `file`: A local file to be uploaded as the asset.

Optional Arguments

- `repo_token`: Defaults to `github.token`.
- `tag`: The tag to upload into. If you want the current event's tag or branch name, use `${{ github.ref }}` (the `refs/tags/` and `refs/heads/` prefixes will be automatically stripped). Defaults to `github.ref`.
- `asset_name`: The name the file gets as an asset on a release. Use `$tag` to include the tag name. When not provided it will default to the filename.
                This is not used if `file_glob` is set to `true`.
- `file_glob`: If set to true, the `file` argument can be a glob pattern (`asset_name` is ignored in this case) (Default: `false`)
- `overwrite`: If an asset with the same name already exists, overwrite it (Default: `false`).
- `promote`: If a prerelease already exists, promote it to a release (Default: `false`).
- `draft`: Sets the release as a draft instead of publishing it, allowing you to make any edits needed before releasing (Default: `false`).
- `prerelease`: Mark the release as a pre-release (Default: `false`).
- `make_latest`: Mark the release as the latest release for the repository (Default: `true`).
- `release_name`: Explicitly set a release name. (Defaults: implicitly same as `tag` via GitHub API).
- `target_commit`: Sets the commit hash or branch for the tag to be based on (Default: the default branch, usually `main`).
- `body`: Content of the release text (Default: `""`).
- `repo_name`: Specify the name of the GitHub repository in which the GitHub release will be created, edited, and deleted. If the repository is other than the current, it is required to create a personal access token with `repo`, `user`, `admin:repo_hook` scopes to the foreign repository and add it as a secret. (Default: current repository).

## Output variables

- `browser_download_url`: The publicly available URL of the asset.

## Usage

This usage assumes you want to build on tag creations only.
This is a common use case as you will want to upload release binaries for your tags.

Simple example:

```yaml
name: Publish

on:
  push:
    tags:
      - '*'

jobs:
  build:
    name: Publish binaries
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3
    - name: Build
      run: cargo build --release
    - name: Upload binaries to release
      uses: svenstaro/upload-release-action@v2
      with:
        repo_token: ${{ secrets.GITHUB_TOKEN }}
        file: target/release/mything
        asset_name: mything
        tag: ${{ github.ref }}
        overwrite: true
        body: "This is my release text"
```

Complex example with more operating systems:

```yaml
name: Publish

on:
  push:
    tags:
      - '*'

jobs:
  publish:
    name: Publish for ${{ matrix.os }}
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            artifact_name: mything
            asset_name: mything-linux-amd64
          - os: windows-latest
            artifact_name: mything.exe
            asset_name: mything-windows-amd64
          - os: macos-latest
            artifact_name: mything
            asset_name: mything-macos-amd64

    steps:
    - uses: actions/checkout@v3
    - name: Build
      run: cargo build --release --locked
    - name: Upload binaries to release
      uses: svenstaro/upload-release-action@v2
      with:
        repo_token: ${{ secrets.GITHUB_TOKEN }}
        file: target/release/${{ matrix.artifact_name }}
        asset_name: ${{ matrix.asset_name }}
        tag: ${{ github.ref }}
```

Example with `file_glob`:

```yaml
name: Publish
on:
  push:
    tags:
      - '*'

jobs:
  build:
    name: Publish binaries
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Build
      run: cargo build --release
    - name: Upload binaries to release
      uses: svenstaro/upload-release-action@v2
      with:
        repo_token: ${{ secrets.GITHUB_TOKEN }}
        file: target/release/my*
        tag: ${{ github.ref }}
        overwrite: true
        file_glob: true
```

Example for creating a release in a foreign repository using `repo_name`:

```yaml
name: Publish

on:
  push:
    tags:
      - '*'

jobs:
  build:
    name: Publish binaries
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3
    - name: Build
      run: cargo build --release
    - name: Upload binaries to release
      uses: svenstaro/upload-release-action@v2
      with:
        repo_name: owner/repository-name
        # A personal access token for the GitHub repository in which the release will be created and edited.
        # It is recommended to create the access token with the following scopes: `repo, user, admin:repo_hook`.
        repo_token: ${{ secrets.YOUR_PERSONAL_ACCESS_TOKEN }}
        file: target/release/mything
        asset_name: mything
        tag: ${{ github.ref }}
        overwrite: true
        body: "This is my release text"
```

**Example for feeding a file from repo to the `body` tag:**

This example covers following points:
* Reading a file present on the repo. For example, `release.md` which is placed in root directory of the repo.
* Modify & push the `release.md` file before triggering this action (create tag for this example) to dynamically change the body of the release.

```yaml
name: Publish

on:
  push:
    tags:
      - '*'

jobs:

  build:
    name: Publish binaries
    runs-on: ubuntu-latest
         
    steps:
      - uses: actions/checkout@v3

      # This step reads a file from repo and use it for body of the release
      # This works on any self-hosted runner OS
      - name: Read release.md and use it as a body of new release
        id: read_release
        shell: bash
        run: |
          r=$(cat path/to/release.md)                       # <--- Read release.md (Provide correct path as per your repo)
          r="${r//'%'/'%25'}"                               # Multiline escape sequences for %
          r="${r//$'\n'/'%0A'}"                             # Multiline escape sequences for '\n'
          r="${r//$'\r'/'%0D'}"                             # Multiline escape sequences for '\r'
          echo "RELEASE_BODY=$r" >> $GITHUB_OUTPUT          # <--- Set environment variable

      - name: Upload Binaries to Release
        uses: svenstaro/upload-release-action@v2
        with:
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          tag: ${{ github.ref }}
          body: |
            ${{ steps.read_release.outputs.RELEASE_BODY }}  # <--- Use environment variables that was created earlier

```

### Permissions

This actions requires writes access to the release. If you are using [granular permissions](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#permissions)
in your workflow, you will need to add the `contents: write` permission to the token:

```yaml
permissions:
  contents: write
```

## Releasing

To release this Action:

- Bump version in `package.json`
- Create `CHANGELOG.md` entry
- `npm update`
- `npm run all`
- `git commit -am <version>`
- `git tag -sm <version> <version>`
- `git push --follow-tags`
- Go to https://github.com/svenstaro/upload-release-action/releases and publish the new version
