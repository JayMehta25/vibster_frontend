import React, { useEffect, useRef, useState, useMemo } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';

const SAMPLE_USERS = [
    { username: 'Arjun', lat: 28.6139, lng: 77.2090, isOnline: true },   // Delhi
    { username: 'Zara', lat: 40.7128, lng: -74.0060, isOnline: false },  // NYC
    { username: 'Kai', lat: 35.6762, lng: 139.6503, isOnline: true },    // Tokyo
    { username: 'Mira', lat: 51.5074, lng: -0.1278, isOnline: true },    // London
    { username: 'Leo', lat: -33.8688, lng: 151.2093, isOnline: false }, // Sydney
    { username: 'Nia', lat: 1.3521, lng: 103.8198, isOnline: true },     // Singapore
    { username: 'Ryo', lat: -23.5505, lng: -46.6333, isOnline: false }, // Sao Paulo
    { username: 'Ava', lat: 55.7558, lng: 37.6173, isOnline: true },    // Moscow
];

const GlobeGallery = ({ friends = [], userLocation, onlineUsers = [], onUserClick }) => {
    const globeRef = useRef();
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [countries, setCountries] = useState({ features: [] });
    const [isLoading, setIsLoading] = useState(true);
    const containerRef = useRef();

    // Resize handler
    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight
                });
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Fetch GeoJSON for country outlines
    useEffect(() => {
        const GEOJSON_URL = 'https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson';
        fetch(GEOJSON_URL)
            .then(res => res.json())
            .then(data => {
                setCountries(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error('GlobeGeoJSON Error:', err);
                fetch('https://unpkg.com/three-globe/example/img/ne_110m_admin_0_countries.geojson')
                    .then(res => res.json())
                    .then(setCountries)
                    .catch(e => console.error('Fallback failed:', e));
            });
    }, []);

    useEffect(() => {
        if (globeRef.current) {
            const controls = globeRef.current.controls();
            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.5;
            controls.enableZoom = true;
            globeRef.current.camera().position.z = 250;
        }
    }, []);

    // Prepare data for the globe
    const globeData = useMemo(() => {
        const friendData = friends
            .map(friend => ({
                lat: friend.latitude,
                lng: friend.longitude,
                name: friend.username,
                isOnline: onlineUsers.includes(friend.username?.toLowerCase()),
                isReal: true,
                raw: friend
            }))
            .filter(d => d.lat && d.lng);

        const sampleData = SAMPLE_USERS.map(user => ({
            lat: user.lat,
            lng: user.lng,
            name: user.username,
            isOnline: user.isOnline,
            isReal: false,
            raw: user
        }));

        return [...friendData, ...sampleData];
    }, [friends, onlineUsers]);

    // Rings/Ripples for online users
    const ringData = useMemo(() => {
        return globeData.filter(d => d.isOnline);
    }, [globeData]);

    // Arcs
    const arcData = useMemo(() => {
        if (!userLocation || !userLocation.lat || !userLocation.lng) return [];
        return globeData
            .filter(d => d.isOnline)
            .map(d => ({
                startLat: userLocation.lat,
                startLng: userLocation.lng,
                endLat: d.lat,
                endLng: d.lng,
                color: ['#00b7ff', '#6c5ce7']
            }));
    }, [userLocation, globeData]);

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <Globe
                ref={globeRef}
                width={dimensions.width}
                height={dimensions.height}
                backgroundColor="rgba(0,0,0,0)"
                showAtmosphere={false}

                globeMaterial={new THREE.MeshPhongMaterial({
                    color: '#000000',
                    transparent: false,
                    opacity: 1.0,
                })}

                showGraticules={true}

                polygonsData={countries.features}
                polygonCapColor={() => 'rgba(255, 255, 255, 0.05)'}
                polygonSideColor={() => 'rgba(0, 0, 0, 0)'}
                polygonStrokeColor={() => 'rgba(255, 255, 255, 0.3)'}
                polygonAltitude={0.01}

                ringsData={ringData}
                ringColor={() => '#22c55e'}
                ringMaxRadius={2.5}
                ringPropagationSpeed={2.5}
                ringRepeatPeriod={800}

                // Custom HTML Markers for Avatars
                htmlElementsData={globeData}
                htmlElement={d => {
                    const el = document.createElement('div');
                    const initials = d.name.slice(0, 2).toUpperCase();
                    const statusColor = d.isOnline ? '#22c55e' : '#ef4444'; // Green vs Red

                    el.innerHTML = `
                        <div class="globe-avatar-wrapper" style="--status-color: ${statusColor}">
                            <div class="globe-avatar-ring"></div>
                            <div class="globe-avatar-content">
                                ${initials}
                            </div>
                            <div class="globe-avatar-label">${d.name}</div>
                        </div>
                    `;
                    el.style.cursor = 'pointer';
                    el.onclick = () => onUserClick && onUserClick(d);
                    return el;
                }}

                arcsData={arcData}
                arcColor="color"
                arcDashLength={0.4}
                arcDashGap={4}
                arcDashAnimateTime={2000}
                arcStroke={0.5}
            />

            {isLoading && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: '12px',
                    fontFamily: 'Rajdhani, sans-serif',
                    fontWeight: 600,
                    letterSpacing: '2px',
                    pointerEvents: 'none',
                    textTransform: 'uppercase'
                }}>
                    Initializing Neural Globe...
                </div>
            )}

            <style>{`
                .globe-avatar-wrapper {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    transition: transform 0.2s ease;
                }
                .globe-avatar-wrapper:hover {
                    transform: scale(1.2);
                    z-index: 100;
                }
                .globe-avatar-ring {
                    position: absolute;
                    width: 32px;
                    height: 32px;
                    border: 2px solid var(--status-color);
                    border-radius: 50%;
                    box-shadow: 0 0 10px var(--status-color);
                    animation: ring-pulse 2s infinite;
                }
                .globe-avatar-content {
                    width: 28px;
                    height: 28px;
                    background: rgba(10, 20, 30, 0.9);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
                    font-size: 10px;
                    font-weight: 800;
                    font-family: 'Rajdhani', sans-serif;
                    z-index: 1;
                    border: 1px solid rgba(255,255,255,0.2);
                }
                .globe-avatar-label {
                    margin-top: 4px;
                    color: #fff;
                    font-size: 9px;
                    font-family: 'Rajdhani', sans-serif;
                    font-weight: 600;
                    text-shadow: 0 0 4px rgba(0,0,0,0.8);
                    white-space: nowrap;
                    background: rgba(0,0,0,0.4);
                    padding: 1px 4px;
                    border-radius: 4px;
                }
                @keyframes ring-pulse {
                    0% { box-shadow: 0 0 5px var(--status-color); }
                    50% { box-shadow: 0 0 15px var(--status-color); }
                    100% { box-shadow: 0 0 5px var(--status-color); }
                }
            `}</style>
        </div>
    );
};

export default GlobeGallery;
