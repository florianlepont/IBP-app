export const impactAsync = jest.fn()
export const notificationAsync = jest.fn()
export const selectionAsync = jest.fn()

export enum ImpactFeedbackStyle {
  Light = "light",
  Medium = "medium",
  Heavy = "heavy",
  Rigid = "rigid",
  Soft = "soft",
}

export enum NotificationFeedbackType {
  Success = "success",
  Warning = "warning",
  Error = "error",
}
