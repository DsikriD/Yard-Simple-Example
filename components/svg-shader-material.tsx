import { shaderMaterial } from '@react-three/drei'
import { extend, useLoader } from '@react-three/fiber'
import * as THREE from 'three'

// SVG иконка елки в base64
const TREE_SVG = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M320 32C327 32 333.7 35.1 338.3 40.5L474.3 200.5C480.4 207.6 481.7 217.6 477.8 226.1C473.9 234.6 465.4 240 456 240L431.1 240L506.3 328.5C512.4 335.6 513.7 345.6 509.8 354.1C505.9 362.6 497.4 368 488 368L449.5 368L538.3 472.5C544.4 479.6 545.7 489.6 541.8 498.1C537.9 506.6 529.4 512 520 512L352 512L352 576C352 593.7 337.7 608 320 608C302.3 608 288 593.7 288 576L288 512L120 512C110.6 512 102.1 506.6 98.2 498.1C94.3 489.6 95.6 479.6 101.7 472.5L190.5 368L152 368C142.6 368 134.1 362.6 130.2 354.1C126.3 345.6 127.6 335.6 133.7 328.5L208.9 240L184 240C174.6 240 166.1 234.6 162.2 226.1C158.3 217.6 159.6 207.6 165.7 200.5L301.7 40.5C306.3 35.1 313 32 320 32z"/></svg>`)))}`

// Вершинный шейдер
const vertexShader = `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Фрагментный шейдер с SVG текстурой
const fragmentShader = `
  varying vec2 vUv;
  uniform sampler2D treeTexture;
  
  void main() {
    // Используем мировые координаты для статичного паттерна
    vec2 worldPos = vUv * 1.5; // Масштабируем для оптимального размера
    
    // Расстояние между елочками
    float spacing = 1.0;
    
    // Создаем сетку для елочек
    vec2 grid = fract(worldPos / spacing);
    
    // Центр каждой ячейки
    vec2 center = vec2(0.5, 0.5);
    vec2 pos = grid - center;
    
    // Используем SVG текстуру для каждой елочки
    vec2 treeUv = pos + center; // Преобразуем в UV координаты для текстуры
    vec4 treeColor = texture2D(treeTexture, treeUv);
    
    // Основной цвет (светло-зеленый)
    vec3 baseColor = vec3(0.56, 0.93, 0.56); // #90EE90
    
    // Если в текстуре есть елка (альфа > 0.1), используем цвет елки
    if (treeColor.a > 0.1) {
      gl_FragColor = vec4(treeColor.rgb, 0.8);
    } else {
      gl_FragColor = vec4(baseColor, 0.8);
    }
  }
`

// Создаем материал
const SvgShaderMaterial = shaderMaterial(
  {
    treeTexture: null,
  },
  vertexShader,
  fragmentShader
)

// Регистрируем материал
extend({ SvgShaderMaterial })

// Компонент-обертка для использования в JSX
export function SvgShaderMaterialComponent() {
  // Загружаем SVG как текстуру
  const texture = useLoader(THREE.TextureLoader, TREE_SVG)
  
  // Настраиваем текстуру
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1, 1)
  texture.needsUpdate = true
  
  // Настройки для устранения мигания
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  
  return <svgShaderMaterial treeTexture={texture} />
} 