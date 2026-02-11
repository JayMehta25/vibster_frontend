"use client";

import { useRef, useEffect, useState } from "react";
import { Renderer, Program, Triangle, Mesh } from "ogl";
import "./StageLight.css";

const DEFAULT_COLOR = "#ff6b35";

const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? [
      parseInt(m[1], 16) / 255,
      parseInt(m[2], 16) / 255,
      parseInt(m[3], 16) / 255,
    ]
    : [1, 1, 1];
};

const getStageLightPosition = (position, w, h) => {
  const outside = 0.3;
  switch (position) {
    case "top-left":
      return { anchor: [0, -outside * h], dir: [0.3, 1] };
    case "top-right":
      return { anchor: [w, -outside * h], dir: [-0.3, 1] };
    case "left":
      return { anchor: [-outside * w, 0.5 * h], dir: [1, 0.2] };
    case "right":
      return { anchor: [(1 + outside) * w, 0.5 * h], dir: [-1, 0.2] };
    case "bottom-left":
      return { anchor: [0, (1 + outside) * h], dir: [0.3, -1] };
    case "bottom-center":
      return { anchor: [0.5 * w, (1 + outside) * h], dir: [0, -1] };
    case "bottom-right":
      return { anchor: [w, (1 + outside) * h], dir: [-0.3, -1] };
    case "center-left":
      return { anchor: [-outside * w, 0.5 * h], dir: [1, 0] };
    case "center-right":
      return { anchor: [(1 + outside) * w, 0.5 * h], dir: [-1, 0] };
    default: // "top-center"
      return { anchor: [0.5 * w, -outside * h], dir: [0, 1] };
  }
};

const StageLight = ({
  lightPosition = "top-center",
  primaryColor = DEFAULT_COLOR,
  secondaryColor = "#ffd700",
  lightSpeed = 1.2,
  lightSpread = 0.6,
  lightIntensity = 1.5,
  rayLength = 1.8,
  pulsating = true,
  fadeDistance = 1.2,
  saturation = 1.2,
  followMouse = true,
  mouseInfluence = 0.15,
  noiseAmount = 0.08,
  distortion = 0.08,
  multiColor = true,
  className = "",
}) => {
  const containerRef = useRef(null);
  const uniformsRef = useRef(null);
  const rendererRef = useRef(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const smoothMouseRef = useRef({ x: 0.5, y: 0.5 });
  const animationIdRef = useRef(null);
  const meshRef = useRef(null);
  const cleanupFunctionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const observerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(containerRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isVisible || !containerRef.current) return;

    if (cleanupFunctionRef.current) {
      cleanupFunctionRef.current();
      cleanupFunctionRef.current = null;
    }

    const initializeWebGL = async () => {
      if (!containerRef.current) return;

      await new Promise((resolve) => setTimeout(resolve, 10));

      if (!containerRef.current) return;

      const renderer = new Renderer({
        dpr: Math.min(window.devicePixelRatio, 2),
        alpha: true,
      });
      rendererRef.current = renderer;

      const gl = renderer.gl;
      gl.canvas.style.width = "100%";
      gl.canvas.style.height = "100%";

      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }
      containerRef.current.appendChild(gl.canvas);

      const vert = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

      const frag = `precision highp float;

uniform float iTime;
uniform vec2  iResolution;

uniform vec2  rayPos;
uniform vec2  rayDir;
uniform vec3  primaryColor;
uniform vec3  secondaryColor;
uniform float lightSpeed;
uniform float lightSpread;
uniform float lightIntensity;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform vec2  mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;
uniform float multiColor;

varying vec2 vUv;

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

vec3 stageLightEffect(vec2 raySource, vec2 rayRefDirection, vec2 coord,
                      float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = normalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);

  float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.3;
  
  float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));

  float distance = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);
  
  float fadeFalloff = clamp((iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance), 0.3, 1.0);
  float pulse = pulsating > 0.5 ? (0.7 + 0.3 * sin(iTime * speed * 2.5)) : 1.0;

  float baseStrength = clamp(
    (0.5 + 0.2 * sin(distortedAngle * seedA + iTime * speed)) +
    (0.4 + 0.3 * cos(-distortedAngle * seedB + iTime * speed * 0.8)),
    0.0, 1.0
  );

  float intensity = baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse * lightIntensity;
  
  return vec3(intensity);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  
  vec2 finalRayDir = rayDir;
  if (mouseInfluence > 0.0) {
    vec2 mouseScreenPos = mousePos * iResolution.xy;
    vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
    finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
  }

  // Multiple light sources for more rays
  vec2 rayPos1 = rayPos;
  vec2 rayPos2 = rayPos + vec2(iResolution.x * 0.1, 0.0);
  vec2 rayPos3 = rayPos - vec2(iResolution.x * 0.1, 0.0);
  vec2 rayPos4 = rayPos + vec2(iResolution.x * 0.05, -iResolution.y * 0.05);
  vec2 rayPos5 = rayPos - vec2(iResolution.x * 0.05, -iResolution.y * 0.05);

  vec3 primaryLight1 = stageLightEffect(rayPos1, finalRayDir, coord, 36.2214, 21.11349, 1.5 * lightSpeed);
  vec3 secondaryLight1 = stageLightEffect(rayPos1, finalRayDir, coord, 22.3991, 18.0234, 1.1 * lightSpeed);
  
  vec3 primaryLight2 = stageLightEffect(rayPos2, finalRayDir, coord, 28.4567, 15.7890, 1.3 * lightSpeed);
  vec3 secondaryLight2 = stageLightEffect(rayPos2, finalRayDir, coord, 19.8765, 12.3456, 0.9 * lightSpeed);
  
  vec3 primaryLight3 = stageLightEffect(rayPos3, finalRayDir, coord, 42.1234, 25.6789, 1.7 * lightSpeed);
  vec3 secondaryLight3 = stageLightEffect(rayPos3, finalRayDir, coord, 31.2345, 20.9876, 1.2 * lightSpeed);
  
  vec3 primaryLight4 = stageLightEffect(rayPos4, finalRayDir, coord, 35.6789, 18.9012, 1.4 * lightSpeed);
  vec3 secondaryLight4 = stageLightEffect(rayPos4, finalRayDir, coord, 24.5678, 16.7890, 1.0 * lightSpeed);
  
  vec3 primaryLight5 = stageLightEffect(rayPos5, finalRayDir, coord, 38.9012, 22.3456, 1.6 * lightSpeed);
  vec3 secondaryLight5 = stageLightEffect(rayPos5, finalRayDir, coord, 27.8901, 19.4567, 1.1 * lightSpeed);

  vec3 finalColor;
  if (multiColor > 0.5) {
    float colorMix = sin(iTime * 0.5) * 0.5 + 0.5;
    vec3 mixedColor = mix(primaryColor, secondaryColor, colorMix);
    finalColor = mixedColor * (
      primaryLight1 * 0.25 + secondaryLight1 * 0.15 +
      primaryLight2 * 0.2 + secondaryLight2 * 0.1 +
      primaryLight3 * 0.2 + secondaryLight3 * 0.1 +
      primaryLight4 * 0.15 + secondaryLight4 * 0.05 +
      primaryLight5 * 0.15 + secondaryLight5 * 0.05
    );
  } else {
    finalColor = primaryColor * (
      primaryLight1 * 0.25 + secondaryLight1 * 0.15 +
      primaryLight2 * 0.2 + secondaryLight2 * 0.1 +
      primaryLight3 * 0.2 + secondaryLight3 * 0.1 +
      primaryLight4 * 0.15 + secondaryLight4 * 0.05 +
      primaryLight5 * 0.15 + secondaryLight5 * 0.05
    );
  }

  if (noiseAmount > 0.0) {
    float n = noise(coord * 0.02 + iTime * 0.15);
    finalColor *= (1.0 - noiseAmount + noiseAmount * n);
  }

  float brightness = 1.0 - (coord.y / iResolution.y) * 0.3;
  finalColor *= brightness;

  if (saturation != 1.0) {
    float gray = dot(finalColor, vec3(0.299, 0.587, 0.114));
    finalColor = mix(vec3(gray), finalColor, saturation);
  }

  fragColor = vec4(finalColor, 1.0);
}

void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}`;

      const uniforms = {
        iTime: { value: 0 },
        iResolution: { value: [1, 1] },

        rayPos: { value: [0, 0] },
        rayDir: { value: [0, 1] },

        primaryColor: { value: hexToRgb(primaryColor) },
        secondaryColor: { value: hexToRgb(secondaryColor) },
        lightSpeed: { value: lightSpeed },
        lightSpread: { value: lightSpread },
        lightIntensity: { value: lightIntensity },
        rayLength: { value: rayLength },
        pulsating: { value: pulsating ? 1.0 : 0.0 },
        fadeDistance: { value: fadeDistance },
        saturation: { value: saturation },
        mousePos: { value: [0.5, 0.5] },
        mouseInfluence: { value: mouseInfluence },
        noiseAmount: { value: noiseAmount },
        distortion: { value: distortion },
        multiColor: { value: multiColor ? 1.0 : 0.0 },
      };
      uniformsRef.current = uniforms;

      const geometry = new Triangle(gl);
      const program = new Program(gl, {
        vertex: vert,
        fragment: frag,
        uniforms,
      });
      const mesh = new Mesh(gl, { geometry, program });
      meshRef.current = mesh;

      const updatePlacement = () => {
        if (!containerRef.current || !renderer) return;

        renderer.dpr = Math.min(window.devicePixelRatio, 2);

        const { clientWidth: wCSS, clientHeight: hCSS } = containerRef.current;
        renderer.setSize(wCSS, hCSS);

        const dpr = renderer.dpr;
        const w = wCSS * dpr;
        const h = hCSS * dpr;

        uniforms.iResolution.value = [w, h];

        const { anchor, dir } = getStageLightPosition(lightPosition, w, h);
        uniforms.rayPos.value = anchor;
        uniforms.rayDir.value = dir;
      };

      const loop = (t) => {
        if (!rendererRef.current || !uniformsRef.current || !meshRef.current) {
          return;
        }

        uniforms.iTime.value = t * 0.001;

        if (followMouse && mouseInfluence > 0.0) {
          const smoothing = 0.9;

          smoothMouseRef.current.x =
            smoothMouseRef.current.x * smoothing +
            mouseRef.current.x * (1 - smoothing);
          smoothMouseRef.current.y =
            smoothMouseRef.current.y * smoothing +
            mouseRef.current.y * (1 - smoothing);

          uniforms.mousePos.value = [
            smoothMouseRef.current.x,
            smoothMouseRef.current.y,
          ];
        }

        try {
          renderer.render({ scene: mesh });
          animationIdRef.current = requestAnimationFrame(loop);
        } catch (error) {
          console.warn("WebGL rendering error:", error);
          return;
        }
      };

      window.addEventListener("resize", updatePlacement);
      updatePlacement();
      animationIdRef.current = requestAnimationFrame(loop);

      cleanupFunctionRef.current = () => {
        if (animationIdRef.current) {
          cancelAnimationFrame(animationIdRef.current);
          animationIdRef.current = null;
        }

        window.removeEventListener("resize", updatePlacement);

        if (renderer) {
          try {
            const canvas = renderer.gl.canvas;
            const loseContextExt =
              renderer.gl.getExtension("WEBGL_lose_context");
            if (loseContextExt) {
              loseContextExt.loseContext();
            }

            if (canvas && canvas.parentNode) {
              canvas.parentNode.removeChild(canvas);
            }
          } catch (error) {
            console.warn("Error during WebGL cleanup:", error);
          }
        }

        rendererRef.current = null;
        uniformsRef.current = null;
        meshRef.current = null;
      };
    };

    initializeWebGL();

    return () => {
      if (cleanupFunctionRef.current) {
        cleanupFunctionRef.current();
        cleanupFunctionRef.current = null;
      }
    };
  }, [
    isVisible,
    lightPosition,
    primaryColor,
    secondaryColor,
    lightSpeed,
    lightSpread,
    lightIntensity,
    rayLength,
    pulsating,
    fadeDistance,
    saturation,
    followMouse,
    mouseInfluence,
    noiseAmount,
    distortion,
    multiColor,
  ]);

  useEffect(() => {
    if (!uniformsRef.current || !containerRef.current || !rendererRef.current)
      return;

    const u = uniformsRef.current;
    const renderer = rendererRef.current;

    u.primaryColor.value = hexToRgb(primaryColor);
    u.secondaryColor.value = hexToRgb(secondaryColor);
    u.lightSpeed.value = lightSpeed;
    u.lightSpread.value = lightSpread;
    u.lightIntensity.value = lightIntensity;
    u.rayLength.value = rayLength;
    u.pulsating.value = pulsating ? 1.0 : 0.0;
    u.fadeDistance.value = fadeDistance;
    u.saturation.value = saturation;
    u.mouseInfluence.value = mouseInfluence;
    u.noiseAmount.value = noiseAmount;
    u.distortion.value = distortion;
    u.multiColor.value = multiColor ? 1.0 : 0.0;

    const { clientWidth: wCSS, clientHeight: hCSS } = containerRef.current;
    const dpr = renderer.dpr;
    const { anchor, dir } = getStageLightPosition(lightPosition, wCSS * dpr, hCSS * dpr);
    u.rayPos.value = anchor;
    u.rayDir.value = dir;
  }, [
    primaryColor,
    secondaryColor,
    lightSpeed,
    lightSpread,
    lightIntensity,
    lightPosition,
    rayLength,
    pulsating,
    fadeDistance,
    saturation,
    mouseInfluence,
    noiseAmount,
    distortion,
    multiColor,
  ]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!containerRef.current || !rendererRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      mouseRef.current = { x, y };
    };

    if (followMouse) {
      window.addEventListener("mousemove", handleMouseMove);
      return () => window.removeEventListener("mousemove", handleMouseMove);
    }
  }, [followMouse]);

  return (
    <div
      ref={containerRef}
      className={`stage-light-container ${className}`.trim()}
    />
  );
};

export default StageLight; 