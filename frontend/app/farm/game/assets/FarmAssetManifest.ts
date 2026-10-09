import { ESSENTIAL_ASSET_MANIFEST, CROP_ASSET_MANIFEST, AssetManifestEntry } from './FarmAssetRegistry';

export const FULL_FARM_ASSET_MANIFEST: AssetManifestEntry[] = [
  ...ESSENTIAL_ASSET_MANIFEST,
  ...CROP_ASSET_MANIFEST,
];
