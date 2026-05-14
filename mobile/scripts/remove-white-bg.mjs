import { Jimp } from "jimp"
import { readdirSync, mkdirSync } from "fs"
import { join, basename, extname } from "path"
import { fileURLToPath } from "url"
import { dirname } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const INPUT_DIR = join(__dirname, "../assets/herbier")
const OUTPUT_DIR = join(__dirname, "../assets/herbier-transparent")

mkdirSync(OUTPUT_DIR, { recursive: true })

const files = readdirSync(INPUT_DIR).filter((f) => /\.(jpg|jpeg|png)$/i.test(f))

for (const file of files) {
  const inputPath = join(INPUT_DIR, file)
  const outputName = basename(file, extname(file)) + ".png"
  const outputPath = join(OUTPUT_DIR, outputName)

  const img = await Jimp.read(inputPath)

  img.scan(0, 0, img.bitmap.width, img.bitmap.height, (_x, _y, idx) => {
    const r = img.bitmap.data[idx]
    const g = img.bitmap.data[idx + 1]
    const b = img.bitmap.data[idx + 2]
    // Remove near-white pixels (tolerance: 20 per channel)
    if (r > 235 && g > 235 && b > 235) {
      img.bitmap.data[idx + 3] = 0
    }
  })

  await img.write(outputPath)
  console.log(`✓ ${file} → ${outputName}`)
}

console.log(`\nDone — ${files.length} images written to assets/herbier-transparent/`)
