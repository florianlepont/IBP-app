import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e8eee7'
  },
  appLayout: {
    flex: 1
  },
  tabScreenContainer: {
    flex: 1,
    position: 'relative'
  },
  mainScroll: {
    flex: 1
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 20
  },
  formScreen: {
    gap: 12
  },
  card: {
    backgroundColor: '#f6faf4',
    borderWidth: 1,
    borderColor: '#d5e1d2',
    borderRadius: 12,
    padding: 16,
    gap: 10
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1d4f3a'
  },
  subtitle: {
    fontSize: 12,
    color: '#4c6c59'
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#265742'
  },
  input: {
    borderWidth: 1,
    borderColor: '#c2d4c3',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#eef4ee'
  },
  factorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  factorItemWide: {
    width: '31%',
    minWidth: 90
  },
  factorKey: {
    fontSize: 12,
    color: '#1d3e61',
    marginBottom: 4
  },
  factorInput: {
    borderWidth: 1,
    borderColor: '#c8d7e6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#fdfefe',
    textAlign: 'center'
  },
  helpCard: {
    borderWidth: 1,
    borderColor: '#e4ebf3',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    backgroundColor: '#f9fbfe'
  },
  helpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  helpToggle: {
    fontSize: 12,
    color: '#1a5ea8',
    fontWeight: '600'
  },
  helpText: {
    fontSize: 12,
    color: '#405b78'
  },
  status: {
    marginTop: 6,
    fontSize: 13,
    color: '#2c5a45'
  },
  meta: {
    fontSize: 12,
    color: '#577262'
  },
  authCompact: {
    borderWidth: 1,
    borderColor: '#dce8f5',
    borderRadius: 10,
    padding: 10,
    gap: 6,
    backgroundColor: '#f8fbff'
  },
  authCompactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  accountHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  authPanel: {
    borderWidth: 1,
    borderColor: '#dce8f5',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    backgroundColor: '#fbfdff'
  },
  avatarCard: {
    borderWidth: 1,
    borderColor: '#dce8f5',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    backgroundColor: '#fbfdff'
  },
  avatarPressable: {
    gap: 8
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#e8eff8'
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef4fb'
  },
  avatarActionHint: {
    fontSize: 12,
    color: '#3f5c79'
  },
  infoCard: {
    borderWidth: 1,
    borderColor: '#dce8f5',
    borderRadius: 10,
    padding: 10,
    gap: 6,
    backgroundColor: '#f7fbff'
  },
  detailCard: {
    borderWidth: 1,
    borderColor: '#d6e5f5',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    backgroundColor: '#f7fbff'
  },
  detailScreenContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 110
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  detailRenameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1
  },
  detailRenameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#b7cce3',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 16,
    color: '#12304f',
    fontWeight: '600'
  },
  detailRenameSaveButton: {
    borderRadius: 999,
    backgroundColor: '#2f8057',
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  detailRenameSaveButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  detailRenameCancelButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c3d6ea',
    backgroundColor: '#f1f7ff',
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  detailRenameCancelButtonText: {
    color: '#2f5478',
    fontSize: 12,
    fontWeight: '700'
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#184369'
  },
  detailSurveyTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#12304f'
  },
  detailHeroShell: {
    marginHorizontal: -26,
    marginTop: -10,
    minHeight: 300,
    borderWidth: 0,
    overflow: 'hidden',
    backgroundColor: '#0f1d29',
    position: 'relative'
  },
  detailHeroMain: {
    width: '100%',
    height: 320,
    backgroundColor: '#0f1d29'
  },
  detailHeroMap: {
    width: '100%',
    height: '100%',
    backgroundColor: '#132434'
  },
  detailHeroPhotoCarousel: {
    width: '100%',
    height: '100%'
  },
  detailHeroPhotoSlide: {
    height: '100%'
  },
  detailHeroPhotoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#132434'
  },
  detailHeroOverlayBadge: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(8, 13, 19, 0.72)'
  },
  detailHeroOverlayBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff'
  },
  detailHeroSwitchThumb: {
    position: 'absolute',
    left: 12,
    top: 12,
    width: 74,
    height: 74,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: '#132434'
  },
  detailHeroSwitchThumbImage: {
    width: '100%',
    height: '100%'
  },
  detailHeroSwitchThumbMap: {
    width: '100%',
    height: '100%'
  },
  detailHeroSwitchThumbLabel: {
    position: 'absolute',
    left: 5,
    right: 5,
    bottom: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(8, 13, 19, 0.72)',
    paddingVertical: 3
  },
  detailHeroSwitchThumbLabelText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center'
  },
  detailHeroActions: {
    position: 'absolute',
    top: 12,
    right: 12,
    alignItems: 'center',
    gap: 8
  },
  detailHeroActionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    backgroundColor: 'rgba(8, 13, 19, 0.72)'
  },
  detailHeroActionButtonDanger: {
    backgroundColor: 'rgba(129, 31, 31, 0.84)',
    borderColor: 'rgba(255, 210, 210, 0.4)'
  },
  detailSection: {
    gap: 6
  },
  detailMetadataCard: {
    borderWidth: 1,
    borderColor: '#dce8f5',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    backgroundColor: '#fbfdff'
  },
  detailParcelsEditButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c6d8ea',
    backgroundColor: '#eef5ff',
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  detailParcelsEditButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f4f79'
  },
  formMapHeroCard: {
    marginHorizontal: -16,
    borderWidth: 1,
    borderColor: '#dbe7f4',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    backgroundColor: '#f8fbff'
  },
  formMapHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  formMapCard: {
    borderWidth: 1,
    borderColor: '#dbe7f4',
    borderRadius: 14,
    padding: 10,
    marginHorizontal: -6,
    gap: 6,
    backgroundColor: '#f8fbff'
  },
  formMapFrame: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden'
  },
  formMap: {
    width: '100%',
    height: 360,
    backgroundColor: '#dbe7f4'
  },
  locationCurrentMapButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f68a3',
    backgroundColor: '#2d7fc4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#0f3d63',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 4
  },
  locationCurrentMapButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff'
  },
  locationAddressCard: {
    borderWidth: 1,
    borderColor: '#c9def3',
    borderRadius: 10,
    backgroundColor: '#eef6ff',
    padding: 10,
    gap: 4
  },
  locationAddressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  locationAddressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f5d8e'
  },
  locationAddressValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: '#1b486f'
  },
  formScoreHeroCard: {
    borderWidth: 1,
    borderColor: '#bad3ee',
    borderRadius: 12,
    backgroundColor: '#eaf4ff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
    marginBottom: 8
  },
  formScoreHeroLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#2e628f'
  },
  formScoreHeroValue: {
    fontSize: 30,
    fontWeight: '800',
    color: '#184d7a'
  },
  formScoreHeroMeta: {
    fontSize: 12,
    color: '#2b5a84'
  },
  factorSectionCard: {
    borderWidth: 1,
    borderColor: '#dbe7f4',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    backgroundColor: '#f9fcff'
  },
  factorSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  formFactorTilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  formFactorTile: {
    width: '31%',
    minWidth: 92,
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
    gap: 5
  },
  formFactorTileComplete: {
    borderColor: '#a9d5be',
    backgroundColor: '#effaf4'
  },
  formFactorTileIncomplete: {
    borderColor: '#d3e1ef',
    backgroundColor: '#ffffff'
  },
  formFactorTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  formFactorTileTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#214b73'
  },
  formFactorTileMeta: {
    fontSize: 11,
    color: '#4e6b88'
  },
  formFactorTileScore: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: '#1f5d8e'
  },
  factorDetailHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  factorDetailProgressText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3a5f83'
  },
  factorDetailTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#12304f'
  },
  factorRetainedScoreCard: {
    borderWidth: 1,
    borderColor: '#b9d4f0',
    borderRadius: 12,
    backgroundColor: '#eaf4ff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2
  },
  factorRetainedScoreLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#2e628f'
  },
  factorRetainedScoreValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#184d7a'
  },
  factorRetainedScoreClass: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2b5a84'
  },
  factorExplainBanner: {
    borderRadius: 12,
    padding: 12,
    gap: 6,
    backgroundColor: '#e8f2ff',
    borderWidth: 1,
    borderColor: '#c3d9f2'
  },
  factorExplainBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f4f79',
    textTransform: 'uppercase'
  },
  factorExplainBannerText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#234f77'
  },
  factorHintCard: {
    borderWidth: 1,
    borderColor: '#dbe7f4',
    borderRadius: 10,
    backgroundColor: '#f7fbff',
    padding: 10,
    gap: 4
  },
  factorHintTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#214b73'
  },
  factorHintText: {
    fontSize: 12,
    color: '#4b6784'
  },
  factorDetailFieldsCard: {
    borderWidth: 1,
    borderColor: '#dbe7f4',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    padding: 10,
    gap: 10
  },
  factorDetailFieldBlock: {
    gap: 4
  },
  factorTilesCard: {
    borderWidth: 1,
    borderColor: '#dbe7f4',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    backgroundColor: '#f8fbff'
  },
  factorTilesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  factorReloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c6d8ea',
    backgroundColor: '#eef5ff',
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  factorReloadButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#255178'
  },
  factorTotalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  scoreHeroCard: {
    borderWidth: 1,
    borderColor: '#b9d4f0',
    borderRadius: 12,
    backgroundColor: '#eaf4ff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2
  },
  scoreHeroLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#2e628f'
  },
  scoreHeroValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#184d7a',
    lineHeight: 36
  },
  scoreHeroMeta: {
    fontSize: 12,
    color: '#2b5a84'
  },
  factorTotalPill: {
    borderRadius: 999,
    backgroundColor: '#e9f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  factorTotalPillStrong: {
    backgroundColor: '#dcecff'
  },
  factorTotalText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1f4f79'
  },
  factorTilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  factorTile: {
    width: '31%',
    minWidth: 90,
    borderWidth: 1,
    borderColor: '#dbe7f4',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    padding: 8,
    gap: 5
  },
  factorTileCompleted: {
    borderColor: '#a9d8bf',
    backgroundColor: '#eff9f3'
  },
  factorTilePending: {
    borderColor: '#dbe7f4',
    backgroundColor: '#f7fbff'
  },
  factorTileEditable: {
    borderColor: '#b7d3f0',
    backgroundColor: '#f2f8ff'
  },
  factorTileIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#eaf3ff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  factorTileIconWrapCompleted: {
    backgroundColor: '#dff3e7'
  },
  factorTileIconWrapPending: {
    backgroundColor: '#eaf3ff'
  },
  factorTileCode: {
    fontSize: 11,
    color: '#3e6285',
    fontWeight: '600'
  },
  factorTileClass: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e4b74'
  },
  factorTileClassCompleted: {
    color: '#216448'
  },
  factorTileClassPending: {
    color: '#4f6983'
  },
  factorTileStatusPill: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    width: 18,
    height: 18,
    borderRadius: 9
  },
  factorTileStatusPillCompleted: {
    backgroundColor: '#ddf3e5'
  },
  factorTileStatusPillPending: {
    backgroundColor: '#e8f1fb'
  },
  factorTileWarning: {
    fontSize: 10,
    color: '#9a4e09',
    fontWeight: '700'
  },
  factorTileHint: {
    fontSize: 10,
    color: '#2a5b8d',
    fontWeight: '700'
  },
  factorsProgressCard: {
    borderWidth: 1,
    borderColor: '#bed4ea',
    borderRadius: 12,
    backgroundColor: '#edf5ff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6
  },
  factorsProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  factorsProgressTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1f527e'
  },
  factorsProgressText: {
    fontSize: 12,
    color: '#2f628d'
  },
  deadlineCard: {
    borderWidth: 1,
    borderColor: '#cfe2f5',
    borderRadius: 12,
    padding: 12,
    gap: 6,
    backgroundColor: '#eef6ff'
  },
  deadlineCardWarning: {
    borderColor: '#f1c08d',
    backgroundColor: '#fff5e9'
  },
  deadlineLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2b577f',
    textTransform: 'uppercase'
  },
  deadlineValue: {
    fontSize: 19,
    fontWeight: '800',
    color: '#123e67'
  },
  deadlineValueWarning: {
    color: '#9a4e09'
  },
  eventRow: {
    borderTopWidth: 1,
    borderTopColor: '#e4edf7',
    paddingTop: 6,
    gap: 2
  },
  eventTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2a5378'
  },
  eventPayload: {
    fontSize: 11,
    color: '#4f6882'
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  summaryItem: {
    fontSize: 12,
    color: '#3f5c79',
    backgroundColor: '#eef4fb',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  filterGroup: {
    gap: 6
  },
  filterGroupCompact: {
    gap: 6
  },
  surveyListContainer: {
    flex: 1,
    padding: 16,
    gap: 10
  },
  surveyListScroll: {
    flex: 1
  },
  surveyListScrollContent: {
    gap: 10,
    paddingBottom: 110
  },
  filterLabel: {
    fontSize: 12,
    color: '#3d5f4c',
    fontWeight: '600'
  },
  filterLabelCompact: {
    fontSize: 12,
    color: '#3d5f4c',
    fontWeight: '700'
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  filterChipsInlineRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    paddingRight: 8
  },
  filterToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  filterIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#bfd2c0',
    backgroundColor: '#edf5ed',
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterAdvancedToggle: {
    borderWidth: 1,
    borderColor: '#bfd2c0',
    borderRadius: 999,
    backgroundColor: '#edf5ed',
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  filterAdvancedToggleText: {
    fontSize: 12,
    color: '#325844',
    fontWeight: '600'
  },
  filterAdvancedPanel: {
    borderWidth: 1,
    borderColor: '#cddbcf',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    backgroundColor: '#f3f8f2'
  },
  filterChip: {
    borderWidth: 1,
    borderColor: '#bfd2c0',
    borderRadius: 999,
    backgroundColor: '#edf5ed',
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  filterChipActive: {
    borderColor: '#2a774f',
    backgroundColor: '#dff1e5'
  },
  filterChipText: {
    fontSize: 12,
    color: '#355845'
  },
  filterChipTextActive: {
    color: '#1f6543',
    fontWeight: '600'
  },
  filterReset: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#e4efe4'
  },
  filterResetText: {
    fontSize: 12,
    color: '#315441',
    fontWeight: '600'
  },
  spacer: {
    height: 2
  },
  miniSpacer: {
    height: 4
  },
  row: {
    borderTopWidth: 1,
    borderTopColor: '#e6eef7',
    paddingTop: 10,
    marginTop: 6,
    gap: 2
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#17395e'
  },
  rowMeta: {
    fontSize: 12,
    color: '#55708b'
  },
  warningText: {
    fontSize: 12,
    color: '#a45b12',
    fontWeight: '600'
  },
  fieldError: {
    marginTop: 4,
    fontSize: 11,
    color: '#b33a3a'
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2e5843'
  },
  badgeNeutral: {
    backgroundColor: '#e5ece5'
  },
  badgeStatusDraft: {
    backgroundColor: '#fff0cc'
  },
  badgeStatusSubmitted: {
    backgroundColor: '#d8efdf'
  },
  badgeSyncPending: {
    backgroundColor: '#ebece6'
  },
  badgeSyncSynced: {
    backgroundColor: '#d8ede0'
  },
  badgeSyncFailed: {
    backgroundColor: '#ffe2e2'
  },
  badgeBlocked: {
    backgroundColor: '#ffd6d6'
  },
  editingTag: {
    fontSize: 12,
    color: '#1a5ea8',
    fontWeight: '600'
  },
  attachmentCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e6eef7',
    borderRadius: 8,
    padding: 8,
    gap: 6,
    backgroundColor: '#fbfdff'
  },
  photoManagerCard: {
    borderWidth: 1,
    borderColor: '#dce8f5',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    backgroundColor: '#fbfdff'
  },
  photoManagerPreview: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    backgroundColor: '#e8eff8'
  },
  photoManagerPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef4fb'
  },
  attachmentHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#25567f'
  },
  attachmentRow: {
    borderTopWidth: 1,
    borderTopColor: '#edf3fa',
    paddingTop: 6,
    gap: 2
  },
  attachmentRowSelected: {
    borderTopColor: '#99bde0',
    backgroundColor: '#f0f7ff',
    borderRadius: 6,
    padding: 6
  },
  attachmentPreview: {
    width: 88,
    height: 88,
    borderRadius: 6,
    backgroundColor: '#edf3fa'
  },
  attachmentText: {
    fontSize: 11,
    color: '#4c6985'
  },
  attachmentError: {
    fontSize: 11,
    color: '#9f3d3d'
  },
  surveyListItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#d6e2d4',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#f7faf5'
  },
  surveyListItemCardSelected: {
    borderColor: '#96c3a5',
    backgroundColor: '#e9f4ea'
  },
  surveyListItemMedia: {
    width: 70,
    height: 70
  },
  surveyListItemPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#e3ebe2'
  },
  surveyListItemPreviewPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8efe7'
  },
  surveyListItemContent: {
    flex: 1,
    gap: 6
  },
  surveyListItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#204f3b'
  },
  surveyListItemMeta: {
    fontSize: 12,
    color: '#607869'
  },
  surveyCompletionRow: {
    gap: 6
  },
  surveyCompletionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2b573f'
  },
  surveyCompletionTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#d8e3d8',
    overflow: 'hidden'
  },
  surveyCompletionFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#2f8057'
  },
  debugCard: {
    borderWidth: 1,
    borderColor: '#dce7f4',
    borderRadius: 10,
    padding: 10,
    gap: 4,
    backgroundColor: '#f8fbff'
  },
  debugAttachmentBlock: {
    gap: 8
  },
  debugSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#204a70'
  },
  debugAttachmentCard: {
    borderWidth: 1,
    borderColor: '#dbe7f4',
    borderRadius: 10,
    padding: 10,
    gap: 3,
    backgroundColor: '#f8fbff'
  },
  debugAttachmentPreview: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#dce7f4'
  },
  debugAttachmentPreviewPlaceholder: {
    width: '100%',
    height: 70,
    borderRadius: 8,
    backgroundColor: '#ecf2f8',
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  actionButton: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1
  },
  actionButtonNeutral: {
    backgroundColor: '#f1f7ff',
    borderColor: '#c5d8ec'
  },
  actionButtonPrimary: {
    backgroundColor: '#e9f2ff',
    borderColor: '#b7d3f0'
  },
  actionButtonDanger: {
    backgroundColor: '#ffeded',
    borderColor: '#e6b3b3'
  },
  actionButtonSuccess: {
    backgroundColor: '#e8f7ef',
    borderColor: '#a8d8bf'
  },
  actionButtonText: {
    color: '#234a6f',
    fontSize: 12,
    fontWeight: '600'
  },
  parcelEditorScreen: {
    flex: 1,
    gap: 10,
    padding: 12,
    backgroundColor: '#e8eee7'
  },
  parcelEditorFullscreen: {
    flex: 1,
    backgroundColor: '#132434'
  },
  parcelEditorFullscreenMap: {
    flex: 1,
    backgroundColor: '#132434'
  },
  parcelEditorOverlayLayer: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 18,
    justifyContent: 'space-between'
  },
  parcelEditorTopPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(8, 13, 19, 0.72)'
  },
  parcelEditorTopPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  parcelEditorFloatingButtons: {
    position: 'absolute',
    right: 12,
    top: 72,
    gap: 10
  },
  parcelEditorFloatingButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    backgroundColor: 'rgba(8, 13, 19, 0.72)'
  },
  parcelEditorFloatingButtonSave: {
    backgroundColor: 'rgba(39, 123, 85, 0.92)',
    borderColor: 'rgba(200, 255, 229, 0.45)'
  },
  parcelEditorFloatingButtonDisabled: {
    opacity: 0.6
  },
  parcelEditorBottomSheet: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d6e5f5',
    backgroundColor: 'rgba(247, 251, 255, 0.96)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6
  },
  parcelEditorBottomTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#163f65'
  },
  parcelEditorBottomMeta: {
    fontSize: 12,
    color: '#4c6783',
    fontWeight: '600'
  },
  parcelEditorMapCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d8e6f5',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f2f7fd'
  },
  parcelEditorMap: {
    width: '100%',
    height: '100%',
    backgroundColor: '#d7e2ee'
  },
  parcelEditorInfoCard: {
    borderWidth: 1,
    borderColor: '#dce8f5',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    backgroundColor: '#fbfdff'
  },
  parcelEditorHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  submitReadyBanner: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#9fd0b3',
    borderRadius: 12,
    backgroundColor: '#e9f7ef',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8
  },
  submitReadyBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  submitReadyBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1f5b42'
  },
  submitReadyBannerText: {
    fontSize: 12,
    color: '#2c664d'
  },
  submitReadyBannerCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#2f8057',
    paddingHorizontal: 11,
    paddingVertical: 7
  },
  submitReadyBannerCtaText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  submitProgressBanner: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e4cf9d',
    borderRadius: 12,
    backgroundColor: '#fff7e9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6
  },
  submitProgressBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  submitProgressBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#7a5a19'
  },
  submitProgressBannerText: {
    fontSize: 12,
    color: '#8b6720'
  },
  submittedReadonlyBanner: {
    borderWidth: 1,
    borderColor: '#a8d8bf',
    borderRadius: 12,
    backgroundColor: '#eef9f3',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6
  },
  submittedReadonlyBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  submittedReadonlyBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1f5b42'
  },
  submittedReadonlyBannerText: {
    fontSize: 12,
    color: '#2f6b4f'
  },
  canonicalCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#d9e8f7',
    borderRadius: 8,
    padding: 8,
    gap: 6,
    backgroundColor: '#f7fbff'
  },
  canonicalHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a466f'
  },
  canonicalHeaderLine: {
    fontSize: 12,
    color: '#204f7b'
  },
  canonicalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e6eef7',
    paddingTop: 6,
    gap: 2
  },
  canonicalTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#204f7b'
  },
  canonicalMeta: {
    fontSize: 12,
    color: '#55708b'
  },
  tabBar: {
    borderTopWidth: 1,
    borderTopColor: '#d9e4f1',
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    gap: 8
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d3e0ee',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#f8fbff'
  },
  tabButtonActive: {
    borderColor: '#2d6fb5',
    backgroundColor: '#e8f2ff'
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#355a80'
  },
  tabButtonTextActive: {
    color: '#1d4f84'
  },
  fabButton: {
    position: 'absolute',
    right: 18,
    bottom: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a764f',
    shadowColor: '#18432e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6
  }
});
