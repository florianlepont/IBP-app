import { useEffect, useMemo, useState } from "react"
import {
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import MapView, { Marker, Region } from "react-native-maps"
import { brandColors, brandSpacing } from "../../app/brand-tokens"
import { computeRegionZoom } from "../../app/map-viewport"
import { SurveyDetailResponse } from "../../app/types"
import { IgnCadastreTileOverlay } from "../../components/IgnCadastreTileOverlay"
import { ParcelOverlayPolygons } from "../../components/ParcelOverlayPolygons"
import { useParcelStatuses } from "../../hooks/useParcelStatuses"
import { LocalAttachment, LocalSurvey } from "../../storage"
import { isPhotoAttachment, resolveDisplayCoordinates } from "../survey-screen-helpers"
import { AttachmentPhotoPreview } from "./AttachmentPhotoPreview"
import { styles } from "./media.styles"

type HeroMode = "map" | "photo"

const DEFAULT_FRANCE_REGION: Region = {
  latitude: 46.603354,
  longitude: 1.888334,
  latitudeDelta: 3.8,
  longitudeDelta: 3.8,
}

type MediaSectionProps = {
  apiUrl: string
  survey: LocalSurvey
  attachments: LocalAttachment[]
  displayLocation: SurveyDetailResponse["display_location"] | undefined
  canEditSurvey: boolean
  // Hidden on the debug tab. The section stays mounted so the map/photo choice
  // and the parcel overlay survive a tab switch.
  hidden: boolean
  onOpenParcels: () => void
  onTakePhoto: (surveyId: string) => Promise<void> | void
  onPickPhoto: (surveyId: string) => Promise<void> | void
  onDeleteAttachment: (surveyId: string, localAttachmentId: string) => Promise<void> | void
}

// Hero media of the survey detail: the parcel map preview or the photo
// carousel, the map/photo switch thumb and the add/delete photo buttons.
export function MediaSection({
  apiUrl,
  survey,
  attachments,
  displayLocation,
  canEditSurvey,
  hidden,
  onOpenParcels,
  onTakePhoto,
  onPickPhoto,
  onDeleteAttachment,
}: MediaSectionProps) {
  const { width: viewportWidth } = useWindowDimensions()
  const mediaSlideWidth = Math.max(viewportWidth - brandSpacing.md * 2, 0)
  const gpsCoordinates = useMemo(
    () => resolveDisplayCoordinates(displayLocation),
    [displayLocation],
  )
  const hasMapPreview = gpsCoordinates !== null
  const mapPreviewRegion = useMemo<Region>(() => {
    if (!gpsCoordinates) return DEFAULT_FRANCE_REGION
    return {
      latitude: gpsCoordinates.lat,
      longitude: gpsCoordinates.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }
  }, [gpsCoordinates])
  const mapPreviewZoom = useMemo(() => computeRegionZoom(mapPreviewRegion), [mapPreviewRegion])
  const { items: parcelStatuses } = useParcelStatuses({
    apiUrl,
    region: mapPreviewRegion,
    enabled: hasMapPreview,
    year: new Date().getFullYear(),
  })
  const photoSlides = useMemo<Array<{ key: string; attachment: LocalAttachment }>>(
    () =>
      attachments
        .filter(isPhotoAttachment)
        .map((attachment) => ({ key: `photo-${attachment.id}`, attachment })),
    [attachments],
  )
  const hasPhotoSlides = photoSlides.length > 0
  const [mediaPageIndex, setMediaPageIndex] = useState(0)
  const [heroMode, setHeroMode] = useState<HeroMode>("map")

  useEffect(() => {
    setMediaPageIndex(0)
  }, [survey.id, photoSlides.length])

  useEffect(() => {
    if (hasMapPreview) {
      setHeroMode("map")
      return
    }
    if (hasPhotoSlides) {
      setHeroMode("photo")
    }
  }, [survey.id, hasMapPreview, hasPhotoSlides])

  if (hidden || !(hasMapPreview || hasPhotoSlides || canEditSurvey)) {
    return null
  }

  const handleAddPicture = (): void => {
    if (survey.status === "submitted") {
      Alert.alert("Read-only survey", "This survey is submitted. Photo upload is disabled.")
      return
    }

    Alert.alert("Add picture", "Choose how to add a photo.", [
      {
        text: "Take photo",
        onPress: () => {
          void onTakePhoto(survey.id)
        },
      },
      {
        text: "Choose from gallery",
        onPress: () => {
          void onPickPhoto(survey.id)
        },
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ])
  }

  const handleDeletePicture = (localAttachmentId: string): void => {
    if (survey.status === "submitted") {
      Alert.alert("Read-only survey", "This survey is submitted. Photo deletion is disabled.")
      return
    }

    Alert.alert("Delete picture", "Remove this photo from the survey?", [
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void onDeleteAttachment(survey.id, localAttachmentId)
        },
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ])
  }

  const handleMediaScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    if (photoSlides.length <= 1) return
    const offsetX = event.nativeEvent.contentOffset.x
    const nextIndex = Math.round(offsetX / mediaSlideWidth)
    const safeIndex = Math.max(0, Math.min(photoSlides.length - 1, nextIndex))
    setMediaPageIndex(safeIndex)
  }
  const currentPhotoAttachment = hasPhotoSlides
    ? (photoSlides[Math.min(mediaPageIndex, photoSlides.length - 1)]?.attachment ?? null)
    : null
  const marker = gpsCoordinates ? (
    <Marker coordinate={{ latitude: gpsCoordinates.lat, longitude: gpsCoordinates.lng }} />
  ) : null

  return (
    <View style={styles.detailHeroShell}>
      {heroMode === "photo" && hasPhotoSlides ? (
        <View style={styles.detailHeroMain}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.detailHeroPhotoCarousel}
            decelerationRate="fast"
            snapToInterval={mediaSlideWidth}
            disableIntervalMomentum
            onMomentumScrollEnd={handleMediaScrollEnd}
          >
            {photoSlides.map((slide) => (
              <View
                key={slide.key}
                style={[styles.detailHeroPhotoSlide, { width: mediaSlideWidth }]}
              >
                <AttachmentPhotoPreview
                  attachment={slide.attachment}
                  imageStyle={styles.detailHeroPhotoImage}
                  placeholderStyle={styles.detailHeroPhotoImage}
                />
              </View>
            ))}
          </ScrollView>
          <View style={styles.detailHeroOverlayBadge}>
            <Ionicons name="images-outline" size={13} color={brandColors.white} />
            <Text style={styles.detailHeroOverlayBadgeText}>
              Photos {mediaPageIndex + 1}/{photoSlides.length}
            </Text>
          </View>
        </View>
      ) : (
        <Pressable style={styles.detailHeroMain} onPress={onOpenParcels} disabled={!canEditSurvey}>
          <MapView
            style={styles.detailHeroMap}
            initialRegion={mapPreviewRegion}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
          >
            <IgnCadastreTileOverlay enabled={mapPreviewZoom >= 15} zIndex={0} />
            <ParcelOverlayPolygons items={parcelStatuses} />
            {marker}
          </MapView>
          <View style={styles.detailHeroOverlayBadge}>
            <Ionicons name="map-outline" size={13} color={brandColors.white} />
            <Text style={styles.detailHeroOverlayBadgeText}>
              {canEditSurvey ? "Tap map to edit parcels" : "Map preview"}
            </Text>
          </View>
        </Pressable>
      )}

      {hasMapPreview && hasPhotoSlides ? (
        <Pressable
          style={styles.detailHeroSwitchThumb}
          onPress={() => setHeroMode(heroMode === "map" ? "photo" : "map")}
        >
          {heroMode === "map" ? (
            photoSlides[0] ? (
              <AttachmentPhotoPreview
                attachment={photoSlides[0].attachment}
                imageStyle={styles.detailHeroSwitchThumbImage}
                placeholderStyle={styles.detailHeroSwitchThumbImage}
              />
            ) : null
          ) : (
            <MapView
              style={styles.detailHeroSwitchThumbMap}
              initialRegion={mapPreviewRegion}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
            >
              {marker}
            </MapView>
          )}
          <View style={styles.detailHeroSwitchThumbLabel}>
            <Text style={styles.detailHeroSwitchThumbLabelText}>
              {heroMode === "map" ? "Photos" : "Map"}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {survey.status !== "submitted" ? (
        <View style={styles.detailHeroActions}>
          <Pressable style={styles.detailHeroActionButton} onPress={handleAddPicture}>
            <Ionicons name="camera-outline" size={16} color={brandColors.white} />
          </Pressable>
          {heroMode === "photo" && currentPhotoAttachment ? (
            <Pressable
              style={[styles.detailHeroActionButton, styles.detailHeroActionButtonDanger]}
              onPress={() => handleDeletePicture(currentPhotoAttachment.id)}
            >
              <Ionicons name="trash-outline" size={16} color={brandColors.white} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}
