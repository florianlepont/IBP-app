import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f5fa'
  },
  appLayout: {
    flex: 1
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
  }
});
