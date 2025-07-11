import {useEffect, useRef} from "react";
import * as Cesium from "cesium";
import {arcgisToGeoJSON} from "arcgis-to-geojson-utils";
import PageContainer from "@/components/ui/PageContainer";

import "cesium/Build/Cesium/Widgets/widgets.css";

// Optional: set Ion token if you're using Cesium terrain
Cesium.Ion.defaultAccessToken = "YOUR_CESIUM_ION_TOKEN"; // Replace or remove if not needed

export default function Settings() {
    const mapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mapRef.current) return;

        const viewer = new Cesium.Viewer(mapRef.current, {
            animation: false,
            timeline: false,
            baseLayerPicker: false,
            sceneModePicker: false,
            geocoder: false,
            homeButton: false,
            navigationHelpButton: false,
            infoBox: false,
            fullscreenButton: false,
        });

        viewer.scene.globe.depthTestAgainstTerrain = true;
        viewer.scene.skyAtmosphere.show = true;
        viewer.scene.fog.enabled = false;
        viewer.scene.globe.showGroundAtmosphere = false;
        viewer.scene.skyBox.show = false;
        viewer.scene.sun.show = false;
        viewer.scene.moon.show = false;

        viewer.scene.setTerrain(
            new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromIonAssetId(1))
        );

        const endpoints = [
            "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Class_Airspace/FeatureServer/0/query" +
            "?where=" + encodeURIComponent("(LOCAL_TYPE = 'CLASS_C') AND (LOWER_CODE = 'SFC')") +
            "&f=json" +
            "&geometryType=esriGeometryEnvelope" +
            "&inSR=102100" +
            "&spatialRel=esriSpatialRelIntersects" +
            "&geometryPrecision=3" +
            "&returnGeometry=true",

            "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Class_Airspace/FeatureServer/0/query" +
            "?where=" + encodeURIComponent("(LOCAL_TYPE = 'CLASS_B') AND (LOWER_CODE = 'SFC')") +
            "&f=json" +
            "&geometryType=esriGeometryEnvelope" +
            "&inSR=102100" +
            "&spatialRel=esriSpatialRelIntersects" +
            "&geometryPrecision=3" +
            "&returnGeometry=true",

            "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Class_Airspace/FeatureServer/0/query" +
            "?where=" + encodeURIComponent("(LOCAL_TYPE = 'CLASS_D') AND (LOWER_CODE = 'SFC')") +
            "   &f=json" +
            "&geometryType=esriGeometryEnvelope" +
            "&inSR=102100" +
            "&spatialRel=esriSpatialRelIntersects" +
            "&geometryPrecision=3" +
            "&returnGeometry=true",
            // Add more URLs as needed
        ];

        endpoints.forEach(url => {
            fetch(url)
                .then(res => res.json())
                .then(data => {
                    const features = Array.isArray(data.features)
                        ? data.features.map(f => arcgisToGeoJSON(f))
                        : [];

                    if (!features.length) return;

                    const geojson = {
                        type: "FeatureCollection",
                        features,
                    };

                    return Cesium.GeoJsonDataSource.load(geojson, {
                        clampToGround: false,
                        stroke: Cesium.Color.BLUE,
                        fill: Cesium.Color.CYAN.withAlpha(0.3),
                        strokeWidth: 1,
                    });
                })
                .then(ds => {
                    if (!ds) return;
                    ds.entities.values.forEach(e => {
                        if (e.polygon) {
                            e.polygon.height = 0;
                            e.polygon.extrudedHeight = 2000; // Replace with logic if needed
                            e.polygon.outline = false;
                        }
                    });
                    viewer.dataSources.add(ds);
                });
        });


        return () => viewer.destroy();
    }, []);


    return (
        <PageContainer>
            <div ref={mapRef} style={{width: "100%", height: "100vh"}}/>
        </PageContainer>
    );
}
