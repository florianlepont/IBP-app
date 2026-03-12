/**
 * Tests for useEditingDraft — survey draft editing + autosave hook.
 *
 * Strategy: spy on React.useRef / React.useEffect so the hook can be called
 * directly without a renderer, without replacing the React module (which would
 * conflict with other tests that use react-test-renderer). Spies are restored
 * after each test so they never leak to other test suites.
 */

jest.mock('react-native', () => ({
  Platform: { select: (opts: Record<string, unknown>) => opts.default ?? Object.values(opts)[0] },
}))

jest.mock('../storage', () => ({
  createLocalDraft: jest.fn(),
  getLocalSurveyDraft: jest.fn(),
  updateLocalDraft: jest.fn(),
}))

import React from 'react'
import { createLocalDraft, getLocalSurveyDraft, updateLocalDraft } from '../storage'
import { useEditingDraft } from './useEditingDraft'

const mockCreateLocalDraft = createLocalDraft as jest.Mock
const mockGetLocalSurveyDraft = getLocalSurveyDraft as jest.Mock
const mockUpdateLocalDraft = updateLocalDraft as jest.Mock

const TEST_SURVEY_ID = 'survey-test-1'

function makeDraftSurvey(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_SURVEY_ID,
    site_name: 'Test site',
    region_version: 'ACA',
    vegetation_stage: 'planitiaire',
    parcel_ids: [],
    factors: {},
    ...overrides,
  }
}

describe('useEditingDraft', () => {
  let useRefSpy: jest.SpyInstance
  let useEffectSpy: jest.SpyInstance
  let setEditingSurveyId: jest.Mock
  let setFormMode: jest.Mock
  let onStatusChange: jest.Mock
  let onCloseSurveyDetail: jest.Mock
  let surveyForm: {
    draftInput: Record<string, unknown>
    resetSurveyForm: jest.Mock
    buildDraftInput: jest.Mock
    applyDraftToForm: jest.Mock
    applyGpsLocation: jest.Mock
  }
  let surveyList: {
    surveys: Record<string, unknown>[]
    refreshLocalSurveys: jest.Mock
    refreshLocalAttachments: jest.Mock
    setSelectedSurveyId: jest.Mock
  }

  function buildHook(editingSurveyId: string | null = null) {
    return useEditingDraft({
      editingSurveyId,
      setEditingSurveyId,
      editingSurveyVisibility: 'private',
      setFormMode,
      surveyForm: surveyForm as never,
      surveyList: surveyList as never,
      onStatusChange,
      onCloseSurveyDetail,
    })
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Spy on React hooks so the hook can be called outside a component context.
    // Using spyOn (not jest.mock) avoids replacing the module and prevents
    // interference with react-test-renderer used in other test files.
    useRefSpy = jest
      .spyOn(React, 'useRef')
      .mockImplementation((initial: unknown) => ({ current: initial }))
    useEffectSpy = jest.spyOn(React, 'useEffect').mockImplementation(() => undefined)

    setEditingSurveyId = jest.fn()
    setFormMode = jest.fn()
    onStatusChange = jest.fn()
    onCloseSurveyDetail = jest.fn()
    surveyForm = {
      draftInput: { site_name: '', region_version: 'ACA', vegetation_stage: 'planitiaire', parcel_ids: [], factors: {} },
      resetSurveyForm: jest.fn(),
      buildDraftInput: jest.fn().mockReturnValue({
        site_name: 'Built site',
        region_version: 'ACA',
        vegetation_stage: 'planitiaire',
        parcel_ids: [],
        factors: {},
      }),
      applyDraftToForm: jest.fn(),
      applyGpsLocation: jest.fn(),
    }
    surveyList = {
      surveys: [],
      refreshLocalSurveys: jest.fn().mockResolvedValue(undefined),
      refreshLocalAttachments: jest.fn().mockResolvedValue(undefined),
      setSelectedSurveyId: jest.fn(),
    }
    mockCreateLocalDraft.mockResolvedValue({
      id: 'draft-new',
      site_name: '',
      status: 'draft',
      visibility: 'private',
      sync_state: 'pending',
      sync_version: 1,
      last_sync_error: null,
    })
    mockUpdateLocalDraft.mockResolvedValue({})
    mockGetLocalSurveyDraft.mockResolvedValue(null)
  })

  afterEach(() => {
    useRefSpy.mockRestore()
    useEffectSpy.mockRestore()
    jest.clearAllTimers()
  })

  // ─── handleOpenCreateSurvey ───────────────────────────────────────────────

  describe('handleOpenCreateSurvey', () => {
    test('resets survey form and closes survey detail', () => {
      const { handleOpenCreateSurvey } = buildHook()

      handleOpenCreateSurvey()

      expect(surveyForm.resetSurveyForm).toHaveBeenCalled()
      expect(onCloseSurveyDetail).toHaveBeenCalled()
      expect(setFormMode).toHaveBeenCalledWith('create')
    })

    test('creates a new local draft asynchronously', async () => {
      const { handleOpenCreateSurvey } = buildHook()

      handleOpenCreateSurvey()
      await new Promise((resolve) => setImmediate(resolve))

      expect(mockCreateLocalDraft).toHaveBeenCalledWith(
        expect.objectContaining({ site_name: '', parcel_ids: [], factors: {} }),
      )
      expect(setEditingSurveyId).toHaveBeenCalledWith('draft-new')
      expect(surveyList.setSelectedSurveyId).toHaveBeenCalledWith('draft-new')
    })

    test('does not start a second draft if bootstrapping is already in progress', async () => {
      const { handleOpenCreateSurvey } = buildHook()

      handleOpenCreateSurvey()
      handleOpenCreateSurvey() // second call before first resolves
      await new Promise((resolve) => setImmediate(resolve))

      expect(mockCreateLocalDraft).toHaveBeenCalledTimes(1)
    })

    test('reports bootstrap error via onStatusChange', async () => {
      mockCreateLocalDraft.mockRejectedValue(new Error('DB full'))
      const { handleOpenCreateSurvey } = buildHook()

      handleOpenCreateSurvey()
      await new Promise((resolve) => setImmediate(resolve))

      expect(onStatusChange).toHaveBeenCalledWith(expect.stringContaining('DB full'))
    })
  })

  // ─── handleCreateDraft ────────────────────────────────────────────────────

  describe('handleCreateDraft', () => {
    test('calls updateLocalDraft when editingSurveyId is set', async () => {
      surveyList.surveys = [{ id: TEST_SURVEY_ID, status: 'draft', visibility: 'public' }]
      const { handleCreateDraft } = buildHook(TEST_SURVEY_ID)

      const result = await handleCreateDraft()

      expect(result).toBe(true)
      expect(mockUpdateLocalDraft).toHaveBeenCalledWith(
        expect.objectContaining({ survey_id: TEST_SURVEY_ID, visibility: 'public' }),
      )
      expect(setEditingSurveyId).toHaveBeenCalledWith(null)
    })

    test('falls back to private visibility when survey not in list', async () => {
      surveyList.surveys = []
      const { handleCreateDraft } = buildHook(TEST_SURVEY_ID)

      await handleCreateDraft()

      expect(mockUpdateLocalDraft).toHaveBeenCalledWith(
        expect.objectContaining({ visibility: 'private' }),
      )
    })

    test('calls createLocalDraft when no editingSurveyId', async () => {
      const { handleCreateDraft } = buildHook(null)

      const result = await handleCreateDraft()

      expect(result).toBe(true)
      expect(mockCreateLocalDraft).toHaveBeenCalled()
      expect(mockUpdateLocalDraft).not.toHaveBeenCalled()
    })

    test('returns false and reports error on exception', async () => {
      mockCreateLocalDraft.mockRejectedValue(new Error('Write failed'))
      const { handleCreateDraft } = buildHook(null)

      const result = await handleCreateDraft()

      expect(result).toBe(false)
      expect(onStatusChange).toHaveBeenCalledWith(expect.stringContaining('Write failed'))
    })
  })

  // ─── handleStartEditSurvey ────────────────────────────────────────────────

  describe('handleStartEditSurvey', () => {
    test('returns false for submitted surveys without touching storage', async () => {
      surveyList.surveys = [{ id: TEST_SURVEY_ID, status: 'submitted' }]
      const { handleStartEditSurvey } = buildHook()

      const result = await handleStartEditSurvey(TEST_SURVEY_ID)

      expect(result).toBe(false)
      expect(onStatusChange).toHaveBeenCalledWith(expect.stringContaining('submitted and read-only'))
      expect(mockGetLocalSurveyDraft).not.toHaveBeenCalled()
    })

    test('returns false when draft is not found locally', async () => {
      surveyList.surveys = [{ id: TEST_SURVEY_ID, status: 'draft' }]
      mockGetLocalSurveyDraft.mockResolvedValue(null)
      const { handleStartEditSurvey } = buildHook()

      const result = await handleStartEditSurvey(TEST_SURVEY_ID)

      expect(result).toBe(false)
      expect(onStatusChange).toHaveBeenCalledWith(expect.stringContaining('not found locally'))
    })

    test('applies draft to form and enters edit mode on success', async () => {
      surveyList.surveys = [{ id: TEST_SURVEY_ID, status: 'draft' }]
      mockGetLocalSurveyDraft.mockResolvedValue(makeDraftSurvey())
      const { handleStartEditSurvey } = buildHook()

      const result = await handleStartEditSurvey(TEST_SURVEY_ID)

      expect(result).toBe(true)
      expect(surveyForm.applyDraftToForm).toHaveBeenCalledWith(makeDraftSurvey())
      expect(setEditingSurveyId).toHaveBeenCalledWith(TEST_SURVEY_ID)
      expect(setFormMode).toHaveBeenCalledWith('edit')
      expect(surveyList.setSelectedSurveyId).toHaveBeenCalledWith(TEST_SURVEY_ID)
    })

    test('returns false and reports error on storage exception', async () => {
      surveyList.surveys = [{ id: TEST_SURVEY_ID, status: 'draft' }]
      mockGetLocalSurveyDraft.mockRejectedValue(new Error('Read error'))
      const { handleStartEditSurvey } = buildHook()

      const result = await handleStartEditSurvey(TEST_SURVEY_ID)

      expect(result).toBe(false)
      expect(onStatusChange).toHaveBeenCalledWith(expect.stringContaining('Read error'))
    })
  })

  // ─── handleSaveSurveyEdits ────────────────────────────────────────────────

  describe('handleSaveSurveyEdits', () => {
    test('returns false when no editingSurveyId is set', async () => {
      const { handleSaveSurveyEdits } = buildHook(null)

      const result = await handleSaveSurveyEdits()

      expect(result).toBe(false)
      expect(onStatusChange).toHaveBeenCalledWith('No survey selected for editing')
    })

    test('calls updateLocalDraft and resets editing state', async () => {
      surveyList.surveys = [{ id: TEST_SURVEY_ID, status: 'draft', visibility: 'private' }]
      const { handleSaveSurveyEdits } = buildHook(TEST_SURVEY_ID)

      const result = await handleSaveSurveyEdits()

      expect(result).toBe(true)
      expect(mockUpdateLocalDraft).toHaveBeenCalledWith(
        expect.objectContaining({ survey_id: TEST_SURVEY_ID }),
      )
      expect(setEditingSurveyId).toHaveBeenCalledWith(null)
      expect(setFormMode).toHaveBeenCalledWith('create')
    })

    test('refreshes surveys and attachments after save', async () => {
      surveyList.surveys = [{ id: TEST_SURVEY_ID, status: 'draft', visibility: 'private' }]
      const { handleSaveSurveyEdits } = buildHook(TEST_SURVEY_ID)

      await handleSaveSurveyEdits()

      expect(surveyList.refreshLocalSurveys).toHaveBeenCalled()
      expect(surveyList.refreshLocalAttachments).toHaveBeenCalled()
    })

    test('returns false and reports error on save exception', async () => {
      surveyList.surveys = [{ id: TEST_SURVEY_ID, status: 'draft', visibility: 'private' }]
      mockUpdateLocalDraft.mockRejectedValue(new Error('Save failed'))
      const { handleSaveSurveyEdits } = buildHook(TEST_SURVEY_ID)

      const result = await handleSaveSurveyEdits()

      expect(result).toBe(false)
      expect(onStatusChange).toHaveBeenCalledWith(expect.stringContaining('Save failed'))
    })
  })
})
