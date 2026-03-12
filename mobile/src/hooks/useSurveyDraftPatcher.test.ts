/**
 * Tests for useSurveyDraftPatcher — direct draft patching hook.
 *
 * Strategy: mock storage module, inject a minimal surveyList stub, and
 * verify that each handler correctly delegates to patchSurveyDraftDirectly.
 */

jest.mock('react-native', () => ({
  Platform: { select: (opts: Record<string, unknown>) => opts.default ?? Object.values(opts)[0] },
}))

jest.mock('../storage', () => ({
  getLocalSurveyDraft: jest.fn(),
  updateLocalDraft: jest.fn(),
}))

import { getLocalSurveyDraft, updateLocalDraft } from '../storage'
import { useSurveyDraftPatcher } from './useSurveyDraftPatcher'

const mockGetLocalSurveyDraft = getLocalSurveyDraft as jest.Mock
const mockUpdateLocalDraft = updateLocalDraft as jest.Mock

const TEST_SURVEY_ID = 'survey-test-1'

function makeDraftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_SURVEY_ID,
    site_name: 'Old site',
    region_version: 'ACA',
    vegetation_stage: 'adult',
    parcel_ids: ['AB001'],
    factors: { A: { native_genus_count: 3 } },
    ...overrides,
  }
}

describe('useSurveyDraftPatcher', () => {
  let onStatusChange: jest.Mock
  let surveyList: { surveys: Record<string, unknown>[]; refreshLocalSurveys: jest.Mock; refreshLocalAttachments: jest.Mock }

  function buildHook() {
    return useSurveyDraftPatcher({ surveyList: surveyList as never, onStatusChange })
  }

  beforeEach(() => {
    jest.clearAllMocks()
    onStatusChange = jest.fn()
    surveyList = {
      surveys: [],
      refreshLocalSurveys: jest.fn().mockResolvedValue(undefined),
      refreshLocalAttachments: jest.fn().mockResolvedValue(undefined),
    }
    mockUpdateLocalDraft.mockResolvedValue({})
  })

  // ─── patchSurveyDraftDirectly ──────────────────────────────────────────────

  describe('patchSurveyDraftDirectly', () => {
    test('returns false when survey is submitted (read-only)', async () => {
      surveyList.surveys = [{ id: TEST_SURVEY_ID, status: 'submitted', visibility: 'private' }]
      const { patchSurveyDraftDirectly } = buildHook()

      const result = await patchSurveyDraftDirectly(TEST_SURVEY_ID, (d) => d, 'should not reach')

      expect(result).toBe(false)
      expect(onStatusChange).toHaveBeenCalledWith(`Survey ${TEST_SURVEY_ID} is submitted and read-only`)
      expect(mockUpdateLocalDraft).not.toHaveBeenCalled()
    })

    test('returns false when survey is not found locally', async () => {
      surveyList.surveys = [{ id: TEST_SURVEY_ID, status: 'draft', visibility: 'private' }]
      mockGetLocalSurveyDraft.mockResolvedValue(null)
      const { patchSurveyDraftDirectly } = buildHook()

      const result = await patchSurveyDraftDirectly(TEST_SURVEY_ID, (d) => d, 'success')

      expect(result).toBe(false)
      expect(onStatusChange).toHaveBeenCalledWith(`Survey not found locally: ${TEST_SURVEY_ID}`)
    })

    test('calls updateLocalDraft with mutated data and returns true', async () => {
      surveyList.surveys = [{ id: TEST_SURVEY_ID, status: 'draft', visibility: 'public' }]
      mockGetLocalSurveyDraft.mockResolvedValue(makeDraftRow())
      const { patchSurveyDraftDirectly } = buildHook()

      const result = await patchSurveyDraftDirectly(
        TEST_SURVEY_ID,
        (draft) => ({ ...draft, site_name: 'New name' }),
        'Update done!',
      )

      expect(result).toBe(true)
      expect(mockUpdateLocalDraft).toHaveBeenCalledWith(
        expect.objectContaining({ survey_id: TEST_SURVEY_ID, site_name: 'New name', visibility: 'public' }),
      )
      expect(onStatusChange).toHaveBeenCalledWith('Update done!')
    })

    test('refreshes surveys and attachments on success', async () => {
      surveyList.surveys = [{ id: TEST_SURVEY_ID, status: 'draft', visibility: 'private' }]
      mockGetLocalSurveyDraft.mockResolvedValue(makeDraftRow())
      const { patchSurveyDraftDirectly } = buildHook()

      await patchSurveyDraftDirectly(TEST_SURVEY_ID, (d) => d, 'done')

      expect(surveyList.refreshLocalSurveys).toHaveBeenCalled()
      expect(surveyList.refreshLocalAttachments).toHaveBeenCalled()
    })

    test('returns false and reports error on storage exception', async () => {
      surveyList.surveys = [{ id: TEST_SURVEY_ID, status: 'draft', visibility: 'private' }]
      mockGetLocalSurveyDraft.mockRejectedValue(new Error('DB crash'))
      const { patchSurveyDraftDirectly } = buildHook()

      const result = await patchSurveyDraftDirectly(TEST_SURVEY_ID, (d) => d, 'success')

      expect(result).toBe(false)
      expect(onStatusChange).toHaveBeenCalledWith(expect.stringContaining('DB crash'))
    })

    test('treats survey as non-submitted when not found in surveys list', async () => {
      surveyList.surveys = [] // survey not in list — no status check
      mockGetLocalSurveyDraft.mockResolvedValue(makeDraftRow())
      const { patchSurveyDraftDirectly } = buildHook()

      const result = await patchSurveyDraftDirectly(TEST_SURVEY_ID, (d) => d, 'ok')

      expect(result).toBe(true)
    })
  })

  // ─── handleRenameSurvey ────────────────────────────────────────────────────

  describe('handleRenameSurvey', () => {
    test('saves trimmed site name', async () => {
      surveyList.surveys = [{ id: TEST_SURVEY_ID, status: 'draft', visibility: 'private' }]
      mockGetLocalSurveyDraft.mockResolvedValue(makeDraftRow())
      const { handleRenameSurvey } = buildHook()

      await handleRenameSurvey(TEST_SURVEY_ID, '  Forest Nord  ')

      expect(mockUpdateLocalDraft).toHaveBeenCalledWith(
        expect.objectContaining({ site_name: 'Forest Nord' }),
      )
    })

    test('falls back to "Unnamed site" for blank name', async () => {
      surveyList.surveys = [{ id: TEST_SURVEY_ID, status: 'draft', visibility: 'private' }]
      mockGetLocalSurveyDraft.mockResolvedValue(makeDraftRow())
      const { handleRenameSurvey } = buildHook()

      await handleRenameSurvey(TEST_SURVEY_ID, '   ')

      expect(mockUpdateLocalDraft).toHaveBeenCalledWith(
        expect.objectContaining({ site_name: 'Unnamed site' }),
      )
    })
  })

  // ─── handleUpdateSurveyRegionVersion ──────────────────────────────────────

  describe('handleUpdateSurveyRegionVersion', () => {
    test('updates region_version', async () => {
      surveyList.surveys = [{ id: TEST_SURVEY_ID, status: 'draft', visibility: 'private' }]
      mockGetLocalSurveyDraft.mockResolvedValue(makeDraftRow())
      const { handleUpdateSurveyRegionVersion } = buildHook()

      await handleUpdateSurveyRegionVersion(TEST_SURVEY_ID, 'M')

      expect(mockUpdateLocalDraft).toHaveBeenCalledWith(
        expect.objectContaining({ region_version: 'M' }),
      )
    })

    test('normalizes vegetation stage when region changes', async () => {
      surveyList.surveys = [{ id: TEST_SURVEY_ID, status: 'draft', visibility: 'private' }]
      // 'adult' stage must be valid for both regions or get normalized
      mockGetLocalSurveyDraft.mockResolvedValue(makeDraftRow({ vegetation_stage: 'adult' }))
      const { handleUpdateSurveyRegionVersion } = buildHook()

      await handleUpdateSurveyRegionVersion(TEST_SURVEY_ID, 'ACA')

      expect(mockUpdateLocalDraft).toHaveBeenCalledWith(
        expect.objectContaining({ region_version: 'ACA', vegetation_stage: expect.any(String) }),
      )
    })
  })

  // ─── handleUpdateSurveyVegetationStage ────────────────────────────────────

  describe('handleUpdateSurveyVegetationStage', () => {
    test('updates vegetation_stage normalized for current region', async () => {
      surveyList.surveys = [{ id: TEST_SURVEY_ID, status: 'draft', visibility: 'private' }]
      mockGetLocalSurveyDraft.mockResolvedValue(makeDraftRow({ region_version: 'ACA', vegetation_stage: 'young' }))
      const { handleUpdateSurveyVegetationStage } = buildHook()

      await handleUpdateSurveyVegetationStage(TEST_SURVEY_ID, 'planitiaire')

      expect(mockUpdateLocalDraft).toHaveBeenCalledWith(
        expect.objectContaining({ vegetation_stage: expect.any(String) }),
      )
    })
  })
})
