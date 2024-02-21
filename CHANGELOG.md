# Changelog

## [2.9.0] - 2024-02-22
- Allow seeting a release as draft [#112](https://github.com/svenstaro/upload-release-action/pull/112) (thanks @ShonP40)

## [2.8.0] - 2024-02-21
- Bump all deps
- Update to node 20

## [2.7.0] - 2023-07-28
- Allow setting an explicit target_commitish [#46](https://github.com/svenstaro/upload-release-action/pull/46) (thanks @Spikatrix)

## [2.6.1] - 2023-05-31
- Do not overwrite body or name if empty [#108](https://github.com/svenstaro/upload-release-action/pull/108) (thanks @regevbr)

## [2.6.0] - 2023-05-23
- Add `make_latest` input parameter. Can be set to `false` to prevent the created release from being marked as the latest release for the repository [#100](https://github.com/svenstaro/upload-release-action/pull/100) (thanks @brandonkelly)
- Don't try to upload empty files [#102](https://github.com/svenstaro/upload-release-action/pull/102) (thanks @Loyalsoldier)
- Bump all deps [#105](https://github.com/svenstaro/upload-release-action/pull/105)
- `overwrite` option also overwrites name and body [#106](https://github.com/svenstaro/upload-release-action/pull/106) (thanks @regevbr)
- Add `promote` option to allow prereleases to be promoted [#74](https://github.com/svenstaro/upload-release-action/pull/74) (thanks @regevbr)

## [2.5.0] - 2023-02-21
- Add retry to upload release [#96](https://github.com/svenstaro/upload-release-action/pull/96) (thanks @sonphantrung)

## [2.4.1] - 2023-02-01
- Modernize octokit usage

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
