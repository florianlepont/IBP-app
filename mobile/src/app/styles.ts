import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f5fa'
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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    gap: 10
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#12304f'
  },
  subtitle: {
    fontSize: 12,
    color: '#34516f'
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1d3e61'
  },
  input: {
    borderWidth: 1,
    borderColor: '#c8d7e6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fdfefe'
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
    color: '#17395e'
  },
  meta: {
    fontSize: 12,
    color: '#4b6480'
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
  mediaHeroSection: {
    gap: 8
  },
  mediaHeroCarousel: {
    width: '100%'
  },
  mediaHeroSlide: {
    width: 320,
    marginRight: 10,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#dbe7f4',
    backgroundColor: '#f3f8fe'
  },
  mediaHeroImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#d7e2ee'
  },
  mediaHeroCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  mediaHeroCaptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#254a6d'
  },
  mediaDeletePictureButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e6b3b3',
    backgroundColor: 'rgba(255, 237, 237, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  mediaDeletePictureButtonDisabled: {
    borderColor: '#cdd9e5',
    backgroundColor: 'rgba(236, 241, 246, 0.95)'
  },
  mediaDeletePictureButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8f3737'
  },
  mediaDeletePictureButtonTextDisabled: {
    color: '#7f92a5'
  },
  mediaAddPictureButton: {
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
  mediaAddPictureButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#255178'
  },
  mediaPlaceholderCard: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d6e1ee',
    backgroundColor: '#eef2f6',
    paddingVertical: 34,
    gap: 6
  },
  mediaPlaceholderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4a6480'
  },
  mediaPlaceholderMeta: {
    fontSize: 12,
    color: '#627c97'
  },
  detailSection: {
    gap: 6
  },
  locationCard: {
    borderWidth: 1,
    borderColor: '#dce8f5',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    backgroundColor: '#fbfdff'
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
  factorTileIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#eaf3ff',
    alignItems: 'center',
    justifyContent: 'center'
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
  factorTileWarning: {
    fontSize: 10,
    color: '#9a4e09',
    fontWeight: '700'
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
    color: '#3f5c79',
    fontWeight: '600'
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
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
    borderColor: '#c6d8ea',
    backgroundColor: '#f7fbff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterAdvancedToggle: {
    borderWidth: 1,
    borderColor: '#c6d8ea',
    borderRadius: 999,
    backgroundColor: '#f7fbff',
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  filterAdvancedToggleText: {
    fontSize: 12,
    color: '#355a80',
    fontWeight: '600'
  },
  filterAdvancedPanel: {
    borderWidth: 1,
    borderColor: '#d9e4f1',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    backgroundColor: '#fbfdff'
  },
  filterChip: {
    borderWidth: 1,
    borderColor: '#c6d8ea',
    borderRadius: 999,
    backgroundColor: '#f7fbff',
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  filterChipActive: {
    borderColor: '#2d6fb5',
    backgroundColor: '#e8f2ff'
  },
  filterChipText: {
    fontSize: 12,
    color: '#335a80'
  },
  filterChipTextActive: {
    color: '#1d4f84',
    fontWeight: '600'
  },
  filterReset: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#edf3fa'
  },
  filterResetText: {
    fontSize: 12,
    color: '#2f5478',
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
    color: '#254b6f'
  },
  badgeNeutral: {
    backgroundColor: '#edf3fa'
  },
  badgeStatusDraft: {
    backgroundColor: '#fff0cc'
  },
  badgeStatusSubmitted: {
    backgroundColor: '#dff4e8'
  },
  badgeSyncPending: {
    backgroundColor: '#f4ebff'
  },
  badgeSyncSynced: {
    backgroundColor: '#dcf3ea'
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
    borderColor: '#e3ecf6',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#f9fcff'
  },
  surveyListItemCardSelected: {
    borderColor: '#9abfe2',
    backgroundColor: '#eef6ff'
  },
  surveyListItemMedia: {
    width: 70,
    height: 70
  },
  surveyListItemPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#e8eff8'
  },
  surveyListItemPreviewPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#edf3fa'
  },
  surveyListItemContent: {
    flex: 1,
    gap: 6
  },
  surveyListItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#17395e'
  },
  surveyListItemMeta: {
    fontSize: 12,
    color: '#55708b'
  },
  surveyCompletionRow: {
    gap: 6
  },
  surveyCompletionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2f5478'
  },
  surveyCompletionTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#dde8f5',
    overflow: 'hidden'
  },
  surveyCompletionFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#1d6fb6'
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
    backgroundColor: '#1d4f84',
    shadowColor: '#0b2744',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6
  }
});
