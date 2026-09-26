import { Animated, Text, View } from "react-native"
import { brandSpacing } from "../../app/brand-tokens"
import { AppScreen } from "../../app/types"
import { StepButton, WIZARD_STEPS, WizardStep } from "./components"
import { headerStyles } from "./header.styles"
import type { WizardAnimation } from "./useWizardScroll"

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
    identity: siteName.trim() ? "Name locked" : "Name your site",
    parcels: !identityReady
      ? "Name required first"
      : selectedParcelCount > 0
        ? `${selectedParcelCount} selected`
        : "Map + context",
    factors: !identityReady
      ? "Name required first"
      : completedFactorCount > 0
        ? `${completedFactorCount}/10 scored`
        : "Start scoring",
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
      title: screen === "edit" ? "Refine survey identity" : "Start a new survey",
      body: "Give the survey a clear name before you anchor it on the cadastre and score the field observations.",
      pills: [
        siteName.trim() || "Name required",
        selectedParcelCount ? `${selectedParcelCount} parcel(s)` : "No parcel yet",
      ],
    }
  }

  if (activeStep === "parcels") {
    return {
      title: "Anchor the survey on the map",
      body: "Select the parcel footprint, then lock the region version and vegetation stage for the scoring rules.",
      pills: [regionLabel, vegetationLabel, `${selectedParcelCount} parcel(s)`],
    }
  }

  return {
    title: "Score the IBP factors",
    body: "Open each factor, enter the observed values, and watch the retained scores build the total live.",
    pills: [
      `IBP ${ibpTotal}`,
      `${completedFactorCount}/10 factors`,
      `${selectedParcelCount} parcel(s)`,
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
  const compactSummary = heroCopy.pills.join(" • ")

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
              Survey wizard · Step {activeStepIndex + 1} of 3
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
            <Text style={headerStyles.compactProgressCount}>Step {activeStepIndex + 1}/3</Text>
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
            label="Identity"
            meta={stepMeta.identity}
            active={activeStep === "identity"}
            complete={identityReady}
            onPress={() => onOpenStep("identity")}
          />
          <StepButton
            index="02"
            label="Parcels"
            meta={stepMeta.parcels}
            active={activeStep === "parcels"}
            complete={parcelsReady}
            disabled={!identityReady}
            onPress={() => onOpenStep("parcels")}
          />
          <StepButton
            index="03"
            label="Factors"
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
