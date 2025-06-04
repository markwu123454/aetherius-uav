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
    bindTo: () => {
    },
    isReady: false,
});

export function useCesiumContext() {
    return useContext(CesiumMapContext);
}

export const useCesiumBindTo = () => useCesiumContext().bindTo;

// === PROVIDER ===
export function CesiumMapProvider({children}: { children: ReactNode }) {
    const viewerRef = useRef<any>(null);
    const [viewer, setViewer] = useState<CesiumViewer | null>(null);
    const [terrainProvider, setTerrainProvider] = useState<TerrainProvider>();
    const [imageryProvider, setImageryProvider] = useState<ImageryProvider>();
    const [mountTarget, setMountTarget] = useState<HTMLElement | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [mapLoaded, setMapLoaded] = useState(false);

    const bindTo = (element: HTMLElement | null) => {
        setMountTarget(element);
    };

    // Load terrain/imagery once
    useEffect(() => {
        createWorldTerrainAsync().then(setTerrainProvider);
        createWorldImageryAsync().then(setImageryProvider);
    }, []);

    // Update viewer reference whenever mount target changes
    // 1. When mountTarget changes, just reset viewer state (don't log yet)
    useEffect(() => {
        if (!mountTarget) {
            setViewer(null);
            setIsReady(false);
        }
    }, [mountTarget]);

    // 2. Separate effect: wait until viewerRef.current.cesiumElement becomes non-null
    useEffect(() => {
        const v = viewerRef.current?.cesiumElement as CesiumViewer | undefined;
        console.log("[Cesium] viewerRef:", viewerRef.current);
        console.log("[Cesium] viewerRef.current?.cesiumElement:", viewerRef.current?.cesiumElement);

        if (!v || mapLoaded) {
            console.log("[Cesium] cesium map undefined or already loaded");
            return;
        }

        console.log("[Cesium] viewer initialized");
        setViewer(v);
        setIsReady(true);

        if (USE_3D_TILES && v.scene.primitives.length === 0) {
            Cesium3DTileset.fromIonAssetId(PHOTOREALISTIC_TILESET_ID)
                .then((tileset) => {
                    v.scene.primitives.add(tileset);
                    console.log(
                        "[Cesium] Photorealistic 3D Tiles loaded (1 root tile quota used)."
                    );
                })
                .catch((err) => {
                    console.error("[Cesium] Failed to load 3D tiles:", err);
                });
            setMapLoaded(true);
        } else if (!USE_3D_TILES) {
            console.log("[Cesium] 3D tiles disabled. Using 2.5D terrain only.");
            setMapLoaded(true);
        } else {
            console.log("[Cesium] Not loading");

        }
    }, [viewerRef.current?.cesiumElement]); // <-- key difference


    return (
        <CesiumMapContext.Provider value={{viewer, bindTo, isReady}}>
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
                        {imageryProvider && <ImageryLayer imageryProvider={imageryProvider}/>}
                    </Viewer>,
                    mountTarget
                )}
        </CesiumMapContext.Provider>
    );
}
