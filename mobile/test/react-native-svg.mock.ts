import React from "react"

const create = (name: string) => {
  const Component = (props: Record<string, unknown>) =>
    React.createElement(name, props, props["children"] as React.ReactNode)
  Component.displayName = name
  return Component
}

export const Svg = create("Svg")
export const G = create("G")
export const Path = create("Path")
export const Rect = create("Rect")
export const Circle = create("Circle")
export const Ellipse = create("Ellipse")
export const Line = create("Line")
export const Polygon = create("Polygon")
export const Polyline = create("Polyline")
export const Text = create("Text")
export const TSpan = create("TSpan")
export const TextPath = create("TextPath")
export const Use = create("Use")
export const Image = create("Image")
export const Symbol = create("Symbol")
export const Defs = create("Defs")
export const LinearGradient = create("LinearGradient")
export const RadialGradient = create("RadialGradient")
export const Stop = create("Stop")
export const ClipPath = create("ClipPath")
export const Pattern = create("Pattern")
export const Mask = create("Mask")
export const ForeignObject = create("ForeignObject")
export const Marker = create("Marker")
