# /new-wallpaper

Add a new wallpaper field to the data pipeline.

## Workflow

1. **Update entity**: Add field to `crawler/models/entities/Wallpaper.ts`
2. **Generate migration**: Run TypeORM migration generator
3. **Run migration**: Apply to SQLite
4. **Update pipeline**: Modify `crawler/utils/add-or-update-wallpaper.ts` to populate new field
5. **Update frontend** (if visible): Add to `website/src/components/WallpaperGrid.tsx` or `WallpaperCard.tsx`
6. **Verify**: Run `pnpm fetch-data` locally, check `docs/` output
