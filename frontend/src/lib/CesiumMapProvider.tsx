import {
  Ion,
  createWorldTerrainAsync,
  createWorldImageryAsync,
  Viewer as CesiumViewer,
  TerrainProvider,
  ImageryProvider,
  Cesium3DTileset,
} from "cesium";
import {
  Viewer,
  ImageryLayer,
} from "resium";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import ReactDOM from "react-dom";

// === CONFIG ===
const CESIUM_CONTAINER_ID = "cesium-container";
const USE_3D_TILES = false;
const PHOTOREALISTIC_TILESET_ID = 2275207;

// === ION TOKEN ===
Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;

// === CONTEXT ===
type CesiumMapContextType = {
  viewer: CesiumViewer | null;
  bindTo: (element: HTMLElement | null) => void;
  isReady: boolean;
};

const CesiumMapContext = createContext<CesiumMapContextType>({
  viewer: null,
  bindTo: () => {},
  isReady: false,
});

export function useCesiumContext() {
  return useContext(CesiumMapContext);
}

export const useCesiumViewer = () => useCesiumContext().viewer;
export const useCesiumBindTo = () => useCesiumContext().bindTo;
export const useCesiumIsReady = () => useCesiumContext().isReady;

// === PROVIDER ===
export function CesiumMapProvider({ children }: { children: ReactNode }) {
  const viewerRef = useRef<any>(null);
  const [viewer, setViewer] = useState<CesiumViewer | null>(null);
  const [terrainProvider, setTerrainProvider] = useState<TerrainProvider>();
  const [imageryProvider, setImageryProvider] = useState<ImageryProvider>();
  const [mountTarget, setMountTarget] = useState<HTMLElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  const bindTo = (element: HTMLElement | null) => {
    setMountTarget(element);
  };

  // Load terrain/imagery once
  useEffect(() => {
    createWorldTerrainAsync().then(setTerrainProvider);
    createWorldImageryAsync().then(setImageryProvider);
  }, []);

  // Set viewer when it mounts
  useEffect(() => {
    const v = viewerRef.current?.cesiumElement;
    if (v && !viewer) {
      setViewer(v);
      setIsReady(true);

      if (USE_3D_TILES) {
        Cesium3DTileset.fromIonAssetId(PHOTOREALISTIC_TILESET_ID)
          .then((tileset) => {
            v.scene.primitives.add(tileset);
            console.log("[Cesium] Photorealistic 3D Tiles loaded (1 root tile quota used).");
          })
          .catch((err) => {
            console.error("[Cesium] Failed to load 3D tiles:", err);
          });
      } else {
        console.log("[Cesium] 3D tiles disabled. Using 2.5D terrain only.");
      }
    }
  }, [viewerRef.current]);

  return (
    <CesiumMapContext.Provider value={{ viewer, bindTo, isReady }}>
      {children}

      {/* Mount Cesium viewer to dynamic container */}
      {mountTarget &&
        ReactDOM.createPortal(
          <Viewer
            ref={viewerRef}
            terrainProvider={terrainProvider}
            baseLayerPicker={false}
            geocoder={false}
            homeButton={false}
            sceneModePicker={false}
            navigationHelpButton={false}
            animation={false}
            timeline={false}
            fullscreenButton={false}
            infoBox={false}
            selectionIndicator={false}
            shouldAnimate
          >
            {imageryProvider && <ImageryLayer imageryProvider={imageryProvider} />}
          </Viewer>,
          mountTarget
        )}
    </CesiumMapContext.Provider>
  );
}
