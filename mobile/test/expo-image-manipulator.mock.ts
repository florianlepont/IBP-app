// jest.fn-based double for "expo-image-manipulator". ImageManipulator.manipulate
// returns a chainable context (resize/rotate/... return the context itself);
// renderAsync resolves an ImageRef whose saveAsync registers a new file in the
// expo-file-system/legacy mock and resolves { uri, width, height }.
import { __setMockFile } from "./expo-file-system-legacy.mock"

export enum SaveFormat {
  JPEG = "jpeg",
  PNG = "png",
  WEBP = "webp",
}

export enum FlipType {
  Vertical = "vertical",
  Horizontal = "horizontal",
}

let defaultWidth = 4032
let defaultHeight = 3024
let saveCounter = 0

export function __setMockImageSize(width: number, height: number): void {
  defaultWidth = width
  defaultHeight = height
}

interface MockImageRef {
  width: number
  height: number
  saveAsync: jest.Mock
}

interface MockManipulatorContext {
  resize: jest.Mock
  rotate: jest.Mock
  flip: jest.Mock
  crop: jest.Mock
  extent: jest.Mock
  reset: jest.Mock
  renderAsync: jest.Mock
}

function createSaveAsync(getWidth: () => number, getHeight: () => number): jest.Mock {
  return jest.fn(() => {
    saveCounter += 1
    const uri = `file:///mock/cache/manipulated-${saveCounter}.jpg`
    __setMockFile(uri, 250000)
    return Promise.resolve({ uri, width: getWidth(), height: getHeight() })
  })
}

function createContext(sourceWidth: number, sourceHeight: number): MockManipulatorContext {
  let width = sourceWidth
  let height = sourceHeight

  const context: MockManipulatorContext = {
    resize: jest.fn((size: { width?: number | null; height?: number | null }) => {
      const hasWidth = typeof size?.width === "number"
      const hasHeight = typeof size?.height === "number"
      if (hasWidth && !hasHeight) {
        const ratio = (size.width as number) / width
        width = size.width as number
        height = Math.round(height * ratio)
      } else if (hasHeight && !hasWidth) {
        const ratio = (size.height as number) / height
        height = size.height as number
        width = Math.round(width * ratio)
      } else if (hasWidth && hasHeight) {
        width = size.width as number
        height = size.height as number
      }
      return context
    }),
    rotate: jest.fn(() => context),
    flip: jest.fn(() => context),
    crop: jest.fn(() => context),
    extent: jest.fn(() => context),
    reset: jest.fn(() => {
      width = sourceWidth
      height = sourceHeight
      return context
    }),
    renderAsync: jest.fn(
      (): Promise<MockImageRef> =>
        Promise.resolve({
          width,
          height,
          saveAsync: createSaveAsync(
            () => width,
            () => height,
          ),
        }),
    ),
  }
  return context
}

export const ImageManipulator = {
  manipulate: jest.fn((_source: string) => createContext(defaultWidth, defaultHeight)),
}

export const manipulateAsync = jest.fn()
