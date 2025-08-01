import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'
import * as THREE from 'three'

// Вершинный шейдер
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  
  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Фрагментный шейдер для дороги с иконками огня
const fragmentShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  uniform sampler2D fireTexture;
  
  void main() {
    // Тестовый шейдер - показываем текстуру как есть
    vec4 fireColor = texture2D(fireTexture, vUv);
    
    // Показываем альфа-канал как яркий красный цвет для отладки
    if (fireColor.a > 0.01) {
      gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // Яркий красный
    } else {
      gl_FragColor = vec4(1.0, 0.55, 0.0, 1.0); // Оранжевый
    }
  }
`

// Создаем материал
const RoadShaderMaterial = shaderMaterial(
  {
    fireTexture: null,
  },
  vertexShader,
  fragmentShader
)

// Регистрируем материал
extend({ RoadShaderMaterial })

// Компонент-обертка для использования в JSX
export function RoadShaderMaterialComponent() {
  // Создаем простую текстуру программно для тестирования
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  
  if (ctx) {
    // Рисуем простой огонь
    ctx.fillStyle = 'rgba(255, 0, 0, 1)' // Красный
    ctx.fillRect(16, 16, 32, 32) // Увеличили размер квадрата
    
    // Создаем текстуру из canvas
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(2, 2) // Уменьшили повторение для больших иконок
    texture.needsUpdate = true
    
    console.log('Test texture created:', texture)
    
    return <primitive object={new RoadShaderMaterial({ fireTexture: texture })} />
  }
  
  // Fallback - возвращаем без текстуры
  return <primitive object={new RoadShaderMaterial({ fireTexture: null })} />
} 