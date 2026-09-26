import { useEffect, useMemo, useState } from "react"
import { Animated, View } from "react-native"
import { REGION_OPTIONS, VEGETATION_STAGE_OPTIONS_BY_REGION } from "../app/constants"
import { computeIbpTotalsFromRetainedScores } from "../app/ibp-scoring"
import {
  AppScreen,
  FactorField,
  FactorKey,
  FactorRetainedScore,
  GpsCaptureResult,
  RegionVersion,
  VegetationStage,
} from "../app/types"
import { FACTOR_ORDER, WizardStep } from "./survey-form/components"
import { FactorsList, computeFactorProgress } from "./survey-form/FactorsList"
import { FormActions } from "./survey-form/FormActions"
import { FormHeader, StepRail, buildHeroCopy, buildStepMeta } from "./survey-form/FormHeader"
import { ParcelMapModal } from "./survey-form/ParcelMapModal"
import { ParcelsSection } from "./survey-form/ParcelsSection"
import { RegionVegetationSection } from "./survey-form/RegionVegetationSection"
import { SiteSection } from "./survey-form/SiteSection"
import { formStyles } from "./survey-form/styles"
import { useParcelMap } from "./survey-form/useParcelMap"
import { useWizardScroll } from "./survey-form/useWizardScroll"
export { toAddressLabel } from "./survey-screen-helpers"
type SurveyFormScreenProps = {
  apiUrl: string
  screen: AppScreen
  editingSurveyId: string | null
  siteName: string
  setSiteName: (value: string) => void
  regionVersion: RegionVersion
  vegetationStage: VegetationStage
  setVegetationStage: (value: VegetationStage) => void
  onRegionChange: (nextRegion: RegionVersion) => void
  gpsLocation: {
    lat: string
    lng: string
    collected_at: string
  }
  selectedParcelIds: string[]
  onToggleParcelSelection: (parcelId: string) => void
  onCaptureGpsLocation: () => Promise<GpsCaptureResult | null>
  factorSections: Record<FactorKey, FactorField[]>
  factorRetainedScores: Record<FactorKey, FactorRetainedScore | null>
  formErrors: { siteName: string | null }
  onOpenFactor: (factor: FactorKey) => void
  onOpenParcelFullscreen: () => void
  onSaveSurveyEdits: () => Promise<void>
  onCreateDraft: () => Promise<void>
  status: string
}

export function SurveyFormScreen({
  apiUrl,
  screen,
  editingSurveyId,
  siteName,
  setSiteName,
  regionVersion,
  vegetationStage,
  setVegetationStage,
  onRegionChange,
  gpsLocation,
  selectedParcelIds,
  onToggleParcelSelection,
  onCaptureGpsLocation,
  factorSections,
  factorRetainedScores,
  formErrors,
  onOpenFactor,
  onOpenParcelFullscreen,
  onSaveSurveyEdits,
  onCreateDraft,
  status: _status,
}: SurveyFormScreenProps) {
  const [activeStep, setActiveStep] = useState<WizardStep>("identity")
  const map = useParcelMap({
    apiUrl,
    screen,
    editingSurveyId,
    gpsLocation,
    activeStep,
    onCaptureGpsLocation,
  })
  const wizard = useWizardScroll(activeStep, setActiveStep)

  const factorProgress = useMemo(() => computeFactorProgress(factorSections), [factorSections])
  const completedFactorCount = FACTOR_ORDER.filter(
    (factor) => factorProgress[factor]?.complete,
  ).length
  const scoreTotals = useMemo(
    () => computeIbpTotalsFromRetainedScores(factorRetainedScores),
    [factorRetainedScores],
  )
  const regionLabel = useMemo(
    () => REGION_OPTIONS.find((option) => option.value === regionVersion)?.label ?? regionVersion,
    [regionVersion],
  )
  const vegetationLabel = useMemo(
    () =>
      VEGETATION_STAGE_OPTIONS_BY_REGION[regionVersion].find(
        (option) => option.value === vegetationStage,
      )?.label ?? vegetationStage,
    [regionVersion, vegetationStage],
  )

  const identityReady = siteName.trim().length > 0
  const parcelsReady = selectedParcelIds.length > 0
  const factorsReady = completedFactorCount === FACTOR_ORDER.length
  const persistLabel = screen === "edit" ? "Save changes" : "Save draft"

  const selectedParcelCount = selectedParcelIds.length
  const ibpTotal = scoreTotals.ibp_total
  const stepMeta = useMemo(
    () => buildStepMeta({ siteName, identityReady, selectedParcelCount, completedFactorCount }),
    [completedFactorCount, identityReady, selectedParcelCount, siteName],
  )
  const heroCopy = useMemo(
    () =>
      buildHeroCopy({
        screen,
        activeStep,
        siteName,
        selectedParcelCount,
        completedFactorCount,
        regionLabel,
        vegetationLabel,
        ibpTotal,
      }),
    [
      activeStep,
      completedFactorCount,
      regionLabel,
      screen,
      ibpTotal,
      selectedParcelCount,
      siteName,
      vegetationLabel,
    ],
  )

  useEffect(() => {
    setActiveStep("identity")
  }, [screen, editingSurveyId])

  const handlePersistSurvey = (): void => {
    if (screen === "edit") {
      void onSaveSurveyEdits()
      return
    }
    void onCreateDraft()
  }

  const handleOpenStep = (nextStep: WizardStep): void => {
    if (nextStep !== "identity" && !identityReady) {
      return
    }
    wizard.openWizardStep(nextStep)
  }

  return (
    <View style={formStyles.container}>
      <FormHeader
        activeStep={activeStep}
        heroCopy={heroCopy}
        heroTopOffset={wizard.heroTopOffset}
        animation={wizard.animation}
      />

      <Animated.ScrollView
        ref={wizard.scrollRef}
        style={formStyles.pageScroll}
        contentContainerStyle={[
          formStyles.pageContent,
          { paddingBottom: wizard.scrollContentBottomPadding },
        ]}
        scrollEnabled={wizard.scrollEnabled}
        bounces={wizard.scrollEnabled}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="never"
        onScroll={wizard.handleScroll}
      >
        <View style={{ height: wizard.topSpacerHeight }} />

        <StepRail
          activeStep={activeStep}
          stepMeta={stepMeta}
          identityReady={identityReady}
          parcelsReady={parcelsReady}
          factorsReady={factorsReady}
          preserveRailSpace={wizard.preserveIdentityRailSpace}
          animation={wizard.animation}
          onOpenStep={handleOpenStep}
        />

        {activeStep === "identity" ? (
          <SiteSection
            siteName={siteName}
            setSiteName={setSiteName}
            siteNameError={formErrors.siteName}
            identityReady={identityReady}
            onLayout={wizard.handleIdentityLayout}
            onFocus={wizard.handleIdentityFocus}
            onBlur={wizard.handleIdentityBlur}
            onContinue={() => handleOpenStep("parcels")}
          />
        ) : null}

        {activeStep === "parcels" ? (
          <>
            <ParcelsSection
              map={map}
              selectedParcelIds={selectedParcelIds}
              onToggleParcelSelection={onToggleParcelSelection}
              onOpenParcelFullscreen={onOpenParcelFullscreen}
            />
            <RegionVegetationSection
              regionVersion={regionVersion}
              vegetationStage={vegetationStage}
              onRegionChange={onRegionChange}
              setVegetationStage={setVegetationStage}
            />
            <FormActions
              primaryLabel="Continue to factors"
              onBack={() => setActiveStep("identity")}
              onPrimary={() => setActiveStep("factors")}
            />
            <ParcelMapModal
              map={map}
              siteName={siteName}
              selectedParcelIds={selectedParcelIds}
              onToggleParcelSelection={onToggleParcelSelection}
            />
          </>
        ) : null}

        {activeStep === "factors" ? (
          <>
            <FactorsList
              factorProgress={factorProgress}
              factorRetainedScores={factorRetainedScores}
              scoreTotals={scoreTotals}
              onOpenFactor={onOpenFactor}
            />
            <FormActions
              primaryLabel={persistLabel}
              onBack={() => setActiveStep("parcels")}
              onPrimary={handlePersistSurvey}
            />
          </>
        ) : null}
      </Animated.ScrollView>
    </View>
  )
}
