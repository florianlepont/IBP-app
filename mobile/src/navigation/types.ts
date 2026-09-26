import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs"
import type { CompositeScreenProps, NavigatorScreenParams } from "@react-navigation/native"
import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import type { FactorKey } from "../app/types"

/**
 * Navigation param lists (phase 01.9-18, moved out of AuthenticatedAppNavigation
 * so the route components can type `navigation` and `route`).
 */
export type HomeStackParamList = {
  homeRoot: undefined
}

export type AccountStackParamList = {
  accountHome: undefined
  settings: undefined
}

export type SurveysStackParamList = {
  surveysHome: undefined
  surveyDetail: undefined
  surveyForm: undefined
  surveyFactorDetail: { factor: FactorKey }
  surveyParcels: { surveyId: string; mode: "wizard" | "edit" }
}

export type PublicMapStackParamList = {
  publicMapHome: undefined
}

export type RootTabParamList = {
  home: NavigatorScreenParams<HomeStackParamList> | undefined
  surveys: NavigatorScreenParams<SurveysStackParamList> | undefined
  search: NavigatorScreenParams<SurveysStackParamList> | undefined
  publicMap: NavigatorScreenParams<PublicMapStackParamList> | undefined
  account: NavigatorScreenParams<AccountStackParamList> | undefined
}

export type FormMode = "create" | "edit"

/** Props of a stack screen whose navigation can also reach the other tabs. */
type StackRouteProps<
  ParamList extends Record<string, object | undefined>,
  RouteName extends keyof ParamList & string,
> = CompositeScreenProps<
  NativeStackScreenProps<ParamList, RouteName>,
  BottomTabScreenProps<RootTabParamList>
>

export type HomeRouteProps = StackRouteProps<HomeStackParamList, "homeRoot">
export type SurveyListRouteProps = StackRouteProps<SurveysStackParamList, "surveysHome">
export type SurveyDetailRouteProps = StackRouteProps<SurveysStackParamList, "surveyDetail">
export type SurveyFormRouteProps = StackRouteProps<SurveysStackParamList, "surveyForm">
export type FactorDetailRouteProps = StackRouteProps<SurveysStackParamList, "surveyFactorDetail">
export type ParcelSelectionRouteProps = StackRouteProps<SurveysStackParamList, "surveyParcels">
export type PublicMapRouteProps = StackRouteProps<PublicMapStackParamList, "publicMapHome">
export type AccountRouteProps = StackRouteProps<AccountStackParamList, "accountHome">
export type SettingsRouteProps = StackRouteProps<AccountStackParamList, "settings">
