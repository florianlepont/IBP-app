import { useMemo } from "react"
import { Platform, View } from "react-native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { brandColors } from "../../app/brand-tokens"
import { useSurveyActions } from "../../state/surveys-context"
import { FactorDetailRoute } from "../routes/FactorDetailRoute"
import { ParcelSelectionRoute } from "../routes/ParcelSelectionRoute"
import { SurveyDetailRoute } from "../routes/SurveyDetailRoute"
import { SurveyFormRoute } from "../routes/SurveyFormRoute"
import { SurveyListRoute } from "../routes/SurveyListRoute"
import { styles } from "../styles"
import type { SurveysStackParamList } from "../types"
import { baseStackScreenOptions } from "./stack-options"
import { SurveysStackConfigContext, type SurveysStackConfig } from "./surveys-stack-config"

const SurveysStack = createNativeStackNavigator<SurveysStackParamList>()

type SurveysTabNavigatorProps = { useNativeNav?: boolean; searchEntry?: boolean }

export function SurveysTabNavigator({
  useNativeNav = false,
  searchEntry = false,
}: SurveysTabNavigatorProps) {
  const surveyActions = useSurveyActions()
  const nativeSearchEnabled = useNativeNav && Platform.OS === "ios" && searchEntry
  const config = useMemo<SurveysStackConfig>(
    () => ({ useNativeNav, searchEntry }),
    [useNativeNav, searchEntry],
  )

  return (
    <SurveysStackConfigContext.Provider value={config}>
      <View style={styles.tabScreenContainer}>
        <SurveysStack.Navigator
          screenOptions={{
            ...baseStackScreenOptions,
            headerLargeTitle: false,
            ...(useNativeNav
              ? {}
              : {
                  headerShown: true,
                  headerTitleAlign: "left",
                  headerTitleStyle: {
                    fontSize: 30,
                    fontWeight: "900" as const,
                    color: brandColors.forest,
                  },
                  headerStyle: { backgroundColor: brandColors.canvas },
                  headerShadowVisible: false,
                  headerTintColor: brandColors.forest,
                }),
          }}
        >
          <SurveysStack.Screen
            name="surveysHome"
            options={{
              title: searchEntry ? "Recherche" : "Mes Relevés",
              headerShown: nativeSearchEnabled,
              headerLargeTitle: false,
              headerTransparent: nativeSearchEnabled ? false : undefined,
              headerBlurEffect: nativeSearchEnabled ? "systemMaterial" : undefined,
              headerShadowVisible: false,
              // headerSearchBarOptions are set by SurveyListRoute (it owns the query).
            }}
            component={SurveyListRoute}
          />
          <SurveysStack.Screen
            name="surveyDetail"
            options={{
              title: "Detail",
              headerLargeTitle: false,
            }}
            listeners={{
              beforeRemove: () => {
                surveyActions.closeSurveyDetailSelection()
              },
            }}
            component={SurveyDetailRoute}
          />
          <SurveysStack.Screen
            name="surveyForm"
            options={{
              // SurveyFormRoute sets the create/edit title.
              title: "New survey",
              headerLargeTitle: false,
            }}
            component={SurveyFormRoute}
          />
          <SurveysStack.Screen
            name="surveyFactorDetail"
            options={({ route }) => ({
              title: `Factor ${route.params.factor}`,
              headerLargeTitle: false,
            })}
            component={FactorDetailRoute}
          />
          <SurveysStack.Screen
            name="surveyParcels"
            options={{
              title: "Parcels",
              headerLargeTitle: false,
              headerStyle: { backgroundColor: "#132434" },
              headerShadowVisible: false,
              headerTintColor: brandColors.white,
              headerTitleStyle: {
                color: brandColors.white,
                fontSize: 18,
                fontWeight: "800" as const,
              },
              contentStyle: { backgroundColor: "#132434" },
            }}
            component={ParcelSelectionRoute}
          />
        </SurveysStack.Navigator>
      </View>
    </SurveysStackConfigContext.Provider>
  )
}
