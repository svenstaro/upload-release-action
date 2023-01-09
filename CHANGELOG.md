# Changelog

## [2.4.0] - 2023-01-09
- Update to node 16
- Bump most dependencies

## [2.3.0] - 2022-06-05
- Now defaults `repo_token` to `${{ github.token }}` and `tag` to `${{ github.ref }}` [#69](https://github.com/svenstaro/upload-release-action/pull/69) (thanks @leighmcculloch)

## [2.2.1] - 2020-12-16
- Added support for the GitHub pagination API for repositories with many releases [#36](https://github.com/svenstaro/upload-release-action/pull/36) (thanks @djpohly)

## [2.2.0] - 2020-10-07
- Add support for ceating a new release in a foreign repository [#25](https://github.com/svenstaro/upload-release-action/pull/25) (thanks @kittaakos)
- Upgrade all deps

## [2.1.1] - 2020-09-25
- Fix `release_name` option [#27](https://github.com/svenstaro/upload-release-action/pull/27) (thanks @kittaakos)

## [2.1.0] - 2020-08-10
- Strip refs/heads/ from the input tag [#23](https://github.com/svenstaro/upload-release-action/pull/23) (thanks @OmarEmaraDev)

## [2.0.0] - 2020-07-03
- Add `prerelease` input parameter. Setting this marks the created release as a pre-release.
- Add `release_name` input parameter. Setting this explicitly sets the title of the release.
- Add `body` input parameter. Setting this sets the text content of the created release.
- Add `browser_download_url` output variable. This contains the publicly accessible download URL of the uploaded artifact.
- Allow for leaving `asset_name` unset. This will cause the asset to use the filename.
