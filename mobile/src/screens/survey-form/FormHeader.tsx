import { Animated, Text, View } from "react-native"
import { brandSpacing } from "../../app/brand-tokens"
import { AppScreen } from "../../app/types"
import { StepButton, WIZARD_STEPS, WizardStep } from "./components"
import { headerStyles } from "./header.styles"
import type { WizardAnimation } from "./useWizardScroll"
import { fr } from "../../i18n"

const HERO_CONTENT_TOP_INSET = 18

export type HeroCopy = { title: string; body: string; pills: string[] }

export type StepMeta = Record<WizardStep, string>

type WizardSummary = {
  screen: AppScreen
  activeStep: WizardStep
  siteName: string
  identityReady: boolean
  selectedParcelCount: number
  completedFactorCount: number
  regionLabel: string
  vegetationLabel: string
  ibpTotal: number
}

export function buildStepMeta({
  siteName,
  identityReady,
  selectedParcelCount,
  completedFactorCount,
}: Pick<
  WizardSummary,
  "siteName" | "identityReady" | "selectedParcelCount" | "completedFactorCount"
>): StepMeta {
  return {
    identity: siteName.trim()
      ? fr.surveyForm.header.steps.nameLocked
      : fr.surveyForm.header.steps.nameYourSite,
    parcels: !identityReady
      ? fr.surveyForm.header.steps.nameRequiredFirst
      : selectedParcelCount > 0
        ? fr.surveyForm.header.steps.selectedCount({ count: selectedParcelCount })
        : fr.surveyForm.header.steps.mapAndContext,
    factors: !identityReady
      ? fr.surveyForm.header.steps.nameRequiredFirst
      : completedFactorCount > 0
        ? fr.surveyForm.header.steps.scoredCount({ count: completedFactorCount })
        : fr.surveyForm.header.steps.startScoring,
  }
}

export function buildHeroCopy({
  screen,
  activeStep,
  siteName,
  selectedParcelCount,
  completedFactorCount,
  regionLabel,
  vegetationLabel,
  ibpTotal,
}: Omit<WizardSummary, "identityReady">): HeroCopy {
  if (activeStep === "identity") {
    return {
      title:
        screen === "edit"
          ? fr.surveyForm.header.identityTitleEdit
          : fr.surveyForm.header.identityTitleCreate,
      body: fr.surveyForm.header.identityBody,
      pills: [
        siteName.trim() || fr.surveyForm.header.nameRequired,
        selectedParcelCount
          ? fr.surveyForm.header.parcelCount({ count: selectedParcelCount })
          : fr.surveyForm.header.noParcelYet,
      ],
    }
  }

  if (activeStep === "parcels") {
    return {
      title: fr.surveyForm.header.parcelsTitle,
      body: fr.surveyForm.header.parcelsBody,
      pills: [
        regionLabel,
        vegetationLabel,
        fr.surveyForm.header.parcelCount({ count: selectedParcelCount }),
      ],
    }
  }

  return {
    title: fr.surveyForm.header.factorsTitle,
    body: fr.surveyForm.header.factorsBody,
    pills: [
      fr.surveyForm.header.ibpTotal({ total: ibpTotal }),
      fr.surveyForm.header.factorCount({ count: completedFactorCount }),
      fr.surveyForm.header.parcelCount({ count: selectedParcelCount }),
    ],
  }
}

export function FormHeader({
  activeStep,
  heroCopy,
  heroTopOffset,
  animation,
}: {
  activeStep: WizardStep
  heroCopy: HeroCopy
  heroTopOffset: number
  animation: WizardAnimation
}) {
  const activeStepIndex = WIZARD_STEPS.indexOf(activeStep)
  const compactSummary = heroCopy.pills.join(fr.surveyForm.header.pillSeparator)

  return (
    <Animated.View
      pointerEvents="none"
      style={[headerStyles.heroShell, { top: heroTopOffset, height: animation.heroHeight }]}
    >
      <View style={headerStyles.heroCard}>
        <View style={headerStyles.heroAccentOrb} />
        <Animated.View
          style={[
            headerStyles.heroExpandedLayer,
            {
              paddingTop: HERO_CONTENT_TOP_INSET,
              opacity: animation.expandedOpacity,
              transform: [{ translateY: animation.expandedTranslateY }],
            },
          ]}
        >
          <View style={headerStyles.heroExpandedHeader}>
            <Text style={headerStyles.heroEyebrow}>
              {fr.surveyForm.header.eyebrow({
                step: activeStepIndex + 1,
                total: WIZARD_STEPS.length,
              })}
            </Text>
            <Text style={headerStyles.heroTitleExpanded}>{heroCopy.title}</Text>
            <Text style={headerStyles.heroBody}>{heroCopy.body}</Text>
          </View>

          <View style={headerStyles.heroMetaRow}>
            {heroCopy.pills.map((pill) => (
              <View key={`${activeStep}-${pill}`} style={headerStyles.heroMetaPill}>
                <Text style={headerStyles.heroMetaPillText}>{pill}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View
          style={[
            headerStyles.heroCompactLayer,
            {
              opacity: animation.compactOpacity,
              transform: [{ translateY: animation.compactTranslateY }],
            },
          ]}
        >
          <Text numberOfLines={1} style={headerStyles.heroCompactSummary}>
            {compactSummary}
          </Text>
          <Animated.View
            style={[
              headerStyles.compactProgressWrap,
              { opacity: animation.compactProgressOpacity },
            ]}
          >
            <Text style={headerStyles.compactProgressCount}>
              {fr.surveyForm.header.compactProgress({
                step: activeStepIndex + 1,
                total: WIZARD_STEPS.length,
              })}
            </Text>
            <View style={headerStyles.compactProgressTrack}>
              {WIZARD_STEPS.map((step, index) => (
                <View
                  key={`compact-progress-${step}`}
                  style={[
                    headerStyles.compactProgressSegment,
                    index < activeStepIndex
                      ? headerStyles.compactProgressSegmentComplete
                      : index === activeStepIndex
                        ? headerStyles.compactProgressSegmentActive
                        : null,
                  ]}
                />
              ))}
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </Animated.View>
  )
}

export function StepRail({
  activeStep,
  stepMeta,
  identityReady,
  parcelsReady,
  factorsReady,
  preserveRailSpace,
  animation,
  onOpenStep,
}: {
  activeStep: WizardStep
  stepMeta: StepMeta
  identityReady: boolean
  parcelsReady: boolean
  factorsReady: boolean
  preserveRailSpace: boolean
  animation: WizardAnimation
  onOpenStep: (step: WizardStep) => void
}) {
  return (
    <Animated.View
      style={[
        headerStyles.stepRailWrap,
        {
          height: preserveRailSpace ? 114 : animation.stepRailHeight,
          marginTop: -brandSpacing.xs,
          opacity: animation.stepRailOpacity,
          transform: [
            { translateY: animation.stepRailTranslateY },
            { scale: animation.stepRailScale },
          ],
        },
      ]}
    >
      <View style={headerStyles.stepRailCard}>
        <View style={headerStyles.stepRow}>
          <StepButton
            index="01"
            label={fr.surveyForm.header.steps.identity}
            meta={stepMeta.identity}
            active={activeStep === "identity"}
            complete={identityReady}
            onPress={() => onOpenStep("identity")}
          />
          <StepButton
            index="02"
            label={fr.surveyForm.header.steps.parcels}
            meta={stepMeta.parcels}
            active={activeStep === "parcels"}
            complete={parcelsReady}
            disabled={!identityReady}
            onPress={() => onOpenStep("parcels")}
          />
          <StepButton
            index="03"
            label={fr.surveyForm.header.steps.factors}
            meta={stepMeta.factors}
            active={activeStep === "factors"}
            complete={factorsReady}
            disabled={!identityReady}
            onPress={() => onOpenStep("factors")}
          />
        </View>
      </View>
    </Animated.View>
  )
}
