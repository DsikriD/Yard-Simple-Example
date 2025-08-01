"use client"

import React, { useRef, useState, useCallback } from "react"
import { Canvas, useThree, useLoader } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import { InnerStrip } from "./components/inner-strip" // Импортируем новый компонент
import { OuterStrip } from "./components/outer-strip" // Импортируем компонент внешней полосы
import { GreenPolygon } from "./components/green-polygon" // Импортируем компонент зеленого полигона

// SVG для знака плюс с черной обводкой, закодированный в Data URL
const PLUS_SVG_DATA_URL =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="28" width="8" height="64" fill="white" stroke="black" strokeWidth="4"/>
      <rect y="28" width="64" height="8" fill="white" stroke="black" strokeWidth="4"/>
    </svg>`,
  )

// Компонент для перетаскиваемой точки контура
function DraggablePoint({
  position,
  onDrag,
  index,
  onDragStart,
  onDragEnd,
}: {
  position: [number, number, number]
  onDrag: (index: number, newPosition: [number, number, number]) => void
  index: number
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera, gl } = useThree()
  const [isDragging, setIsDragging] = useState(false)

  const handlePointerDown = useCallback(
    (event: any) => {
      event.stopPropagation()
      setIsDragging(true)
      onDragStart()
      gl.domElement.style.cursor = "grabbing"
    },
    [gl, onDragStart],
  )

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
    onDragEnd()
    gl.domElement.style.cursor = "auto"
  }, [gl, onDragEnd])

  const handlePointerMove = useCallback(
    (event: any) => {
      if (!isDragging) return

      event.stopPropagation()

      const rect = gl.domElement.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      const vector = new THREE.Vector3(x, y, 0)
      vector.unproject(camera)

      const dir = vector.sub(camera.position).normalize()
      const distance = -camera.position.z / dir.z
      const pos = camera.position.clone().add(dir.multiplyScalar(distance))

      onDrag(index, [pos.x, pos.y, 0])
    },
    [isDragging, camera, gl, onDrag, index],
  )

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener("pointermove", handlePointerMove)
      document.addEventListener("pointerup", handlePointerUp)
      return () => {
        document.removeEventListener("pointermove", handlePointerMove)
        document.removeEventListener("pointerup", handlePointerUp)
      }
    }
  }, [isDragging, handlePointerMove, handlePointerUp])

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerDown={handlePointerDown}
      onPointerEnter={() => (gl.domElement.style.cursor = "grab")}
      onPointerLeave={() => !isDragging && (gl.domElement.style.cursor = "auto")}
    >
      <sphereGeometry args={[0.1, 16, 16]} />
      <meshStandardMaterial color={isDragging ? "#ff6b6b" : "#4ecdc4"} />
    </mesh>
  )
}

// Компонент для переключения стороны (лампочка)
function SideToggle({
  position,
  isActive,
  onToggle,
  sideIndex,
}: {
  position: [number, number, number]
  isActive: boolean
  onToggle: (sideIndex: number) => void
  sideIndex: number
}) {
  const handleClick = useCallback(
    (event: any) => {
      event.stopPropagation() // Останавливаем распространение, чтобы не сработал клик по линии
      onToggle(sideIndex)
    },
    [onToggle, sideIndex],
  )

  return (
    <group position={position} onClick={handleClick}>
      {/* Колба лампочки */}
      <mesh position={[0, 0.02, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color={isActive ? "#00ff00" : "#ff0000"} />
      </mesh>
      {/* Цоколь лампочки */}
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.05, 16]} />
        <meshStandardMaterial color="#555555" /> {/* Серый цвет для цоколя */}
      </mesh>
    </group>
  )
}

// Компонент для добавления новой точки
function AddPointIndicator({
  position,
  onAddPoint,
  segmentIndex,
}: {
  position: [number, number, number]
  onAddPoint: (segmentIndex: number, newPointPosition: [number, number, number]) => void
  segmentIndex: number
}) {
  const texture = useLoader(THREE.TextureLoader, PLUS_SVG_DATA_URL)

  const handleClick = useCallback(
    (event: any) => {
      event.stopPropagation() // Останавливаем распространение
      onAddPoint(segmentIndex, [event.point.x, event.point.y, 0])
    },
    [onAddPoint, segmentIndex],
  )

  return (
    <sprite position={position} onClick={handleClick} scale={[0.2, 0.2, 1]}>
      <spriteMaterial map={texture} color="white" /> {/* Цвет спрайта */}
    </sprite>
  )
}

// Вспомогательная функция для нахождения пересечения двух линий
function lineLineIntersection(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  p4: [number, number],
): [number, number] | null {
  const x1 = p1[0],
    y1 = p1[1]
  const x2 = p2[0],
    y2 = p2[1]
  const x3 = p3[0],
    y3 = p3[1]
  const x4 = p4[0],
    y4 = p4[1]

  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  if (Math.abs(den) < 1e-6) {
    // Линии параллельны или коллинеарны
    return null
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den

  const ix = x1 + t * (x2 - x1)
  const iy = y1 + t * (y2 - y1)

  return [ix, iy]
}

// Компонент сплошной полосы с улучшенной обработкой углов
function SolidStrip({
  squarePoints,
  activeSides,
  stripWidth,
}: {
  squarePoints: [number, number, number][]
  activeSides: boolean[]
  stripWidth: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  const generateStripGeometry = useCallback(() => {
    const vertices: number[] = []
    const indices: number[] = []
    let vertexIndex = 0
    const numPoints = squarePoints.length

    // Функция для получения нормали к стороне (направленной внутрь)
    const getInwardNormal = (sideIndex: number) => {
      const start = squarePoints[sideIndex]
      const end = squarePoints[(sideIndex + 1) % numPoints]

      // Вектор стороны
      const sideVec = new THREE.Vector2(end[0] - start[0], end[1] - start[1])

      // Нормаль (поворот на 90 градусов)
      const normal = new THREE.Vector2(-sideVec.y, sideVec.x).normalize()

      // Проверяем, направлена ли нормаль внутрь (используем центр полигона)
      const centerX = squarePoints.reduce((sum, p) => sum + p[0], 0) / numPoints
      const centerY = squarePoints.reduce((sum, p) => sum + p[1], 0) / numPoints

      const midX = (start[0] + end[0]) / 2
      const midY = (start[1] + end[1]) / 2
      const toCenter = new THREE.Vector2(centerX - midX, centerY - midY)
      const dot = normal.dot(toCenter)

      if (dot < 0) {
        normal.negate() // Разворачиваем нормаль, если она смотрит наружу
      }

      return [normal.x, normal.y]
    }

    // Pre-calculate inner points for all corners
    const calculatedInnerPoints: [number, number, number][] = new Array(numPoints).fill(null)

    for (let k = 0; k < numPoints; k++) {
      const pCurr = new THREE.Vector2(squarePoints[k][0], squarePoints[k][1])
      const pPrev = new THREE.Vector2(
        squarePoints[(k - 1 + numPoints) % numPoints][0],
        squarePoints[(k - 1 + numPoints) % numPoints][1],
      )
      const pNext = new THREE.Vector2(squarePoints[(k + 1) % numPoints][0], squarePoints[(k + 1) % numPoints][1])

      const isPrevSideActive = activeSides[(k - 1 + numPoints) % numPoints]
      const isCurrSideActive = activeSides[k]

      const normalPrev = new THREE.Vector2().fromArray(getInwardNormal((k - 1 + numPoints) % numPoints))
      const normalCurr = new THREE.Vector2().fromArray(getInwardNormal(k))

      if (isPrevSideActive && isCurrSideActive) {
        // Both sides active: Miter or Bevel Joint
        const offsetLine1_p1 = pPrev.clone().add(normalPrev.clone().multiplyScalar(stripWidth))
        const offsetLine1_p2 = pCurr.clone().add(normalPrev.clone().multiplyScalar(stripWidth))

        const offsetLine2_p1 = pCurr.clone().add(normalCurr.clone().multiplyScalar(stripWidth))
        const offsetLine2_p2 = pNext.clone().add(normalCurr.clone().multiplyScalar(stripWidth))

        const intersection = lineLineIntersection(
          offsetLine1_p1.toArray() as [number, number],
          offsetLine1_p2.toArray() as [number, number],
          offsetLine2_p1.toArray() as [number, number],
          offsetLine2_p2.toArray() as [number, number],
        )

        if (intersection) {
          const intersectionVec = new THREE.Vector2(intersection[0], intersection[1])
          const miterLength = pCurr.distanceTo(intersectionVec)
          const miterLimitRatio = 4 // Max miter length is 4x stripWidth

          // If miter is too long, use a bevel (simple perpendicular offset from pCurr along current normal)
          if (miterLength > stripWidth * miterLimitRatio) {
            calculatedInnerPoints[k] = [pCurr.x + normalCurr.x * stripWidth, pCurr.y + normalCurr.y * stripWidth, 0]
          } else {
            calculatedInnerPoints[k] = [intersection[0], intersection[1], 0]
          }
        } else {
          // Fallback for parallel lines or no intersection: use a simple perpendicular offset
          calculatedInnerPoints[k] = [pCurr.x + normalCurr.x * stripWidth, pCurr.y + normalCurr.y * stripWidth, 0]
        }
      } else if (isCurrSideActive) {
        // Активна только текущая сторона (начало сегмента полосы)
        // Просто смещаем точку pCurr по нормали текущей стороны
        calculatedInnerPoints[k] = [pCurr.x + normalCurr.x * stripWidth, pCurr.y + normalCurr.y * stripWidth, 0]
      } else if (isPrevSideActive) {
        // Активна только предыдущая сторона (конец сегмента полосы)
        // Просто смещаем точку pCurr по нормали предыдущей стороны
        calculatedInnerPoints[k] = [pCurr.x + normalPrev.x * stripWidth, pCurr.y + normalPrev.y * stripWidth, 0]
      } else {
        // Neither side active, this point is not part of an active strip
        calculatedInnerPoints[k] = [pCurr.x, pCurr.y, 0] // Should not be used for active segments
      }
    }

    // Генерируем полосы для каждой активной стороны
    for (let i = 0; i < numPoints; i++) {
      if (!activeSides[i]) continue // Пропускаем неактивные стороны

      const outerStart = squarePoints[i]
      const outerEnd = squarePoints[(i + 1) % numPoints]

      // Внутренние точки берутся из предварительно рассчитанных
      const innerStart = calculatedInnerPoints[i]
      const innerEnd = calculatedInnerPoints[(i + 1) % numPoints]

      // Добавляем вершины для прямоугольника (outerStart, outerEnd, innerEnd, innerStart)
      // outerStart и outerEnd всегда соответствуют точкам исходного контура
      vertices.push(...outerStart, ...outerEnd, ...innerEnd, ...innerStart)

      // Добавляем индексы для двух треугольников
      const baseIndex = vertexIndex
      indices.push(
        baseIndex,
        baseIndex + 1,
        baseIndex + 2, // Первый треугольник
        baseIndex,
        baseIndex + 2,
        baseIndex + 3, // Второй треугольник
      )

      vertexIndex += 4
    }

    // Создаем геометрию
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    return geometry
  }, [squarePoints, activeSides, stripWidth])

  React.useEffect(() => {
    if (meshRef.current) {
      const newGeometry = generateStripGeometry()
      meshRef.current.geometry.dispose()
      meshRef.current.geometry = newGeometry
    }
  }, [generateStripGeometry])

  return (
    <mesh ref={meshRef} geometry={generateStripGeometry()} position={[0, 0, 0.01]}>
      {" "}
      {/* Z-координата для видимости над дорогой */}
      <meshStandardMaterial color="#FFD700" />
    </mesh>
  )
}

// Основной компонент сцены
function Scene({
  squarePoints,
  setSquarePoints,
  activeSides,
  setActiveSides,
  stripWidth,
  orangeStripOffset,
  orangeStripWidth,
}: {
  squarePoints: [number, number, number][]
  setSquarePoints: React.Dispatch<React.SetStateAction<[number, number, number][]>>
  activeSides: boolean[]
  setActiveSides: React.Dispatch<React.SetStateAction<boolean[]>>
  stripWidth: number
  orangeStripOffset: number
  orangeStripWidth: number
}) {
  const [isDragging, setIsDragging] = useState(false)

  const handlePointDrag = useCallback(
    (index: number, newPosition: [number, number, number]) => {
      setSquarePoints((prev) => {
        const newPoints = [...prev]
        newPoints[index] = newPosition
        return newPoints
      })
    },
    [setSquarePoints],
  )

  const handleSideToggle = useCallback(
    (sideIndex: number) => {
      setActiveSides((prev) => {
        const newActiveSides = [...prev]
        newActiveSides[sideIndex] = !newActiveSides[sideIndex]
        return newActiveSides
      })
    },
    [setActiveSides],
  )

  const handleAddPoint = useCallback(
    (segmentIndex: number, newPointPosition: [number, number, number]) => {
      setSquarePoints((prevPoints) => {
        const newPoints = [...prevPoints]
        newPoints.splice(segmentIndex + 1, 0, newPointPosition)
        return newPoints
      })

      setActiveSides((prevActiveSides) => {
        const newActiveSides = [...prevActiveSides]
        const wasActive = newActiveSides[segmentIndex]
        newActiveSides.splice(segmentIndex + 1, 0, wasActive)
        return newActiveSides
      })
    },
    [setSquarePoints, setActiveSides],
  )

  // Функция для получения нормали к стороне (направленной внутрь)
  const getInwardNormal = useCallback(
    (sideIndex: number) => {
      const start = squarePoints[sideIndex]
      const end = squarePoints[(sideIndex + 1) % squarePoints.length]
      const sideVec = new THREE.Vector2(end[0] - start[0], end[1] - start[1])
      const normal = new THREE.Vector2(-sideVec.y, sideVec.x).normalize()

      const centerX = squarePoints.reduce((sum, p) => sum + p[0], 0) / squarePoints.length
      const centerY = squarePoints.reduce((sum, p) => sum + p[1], 0) / squarePoints.length
      const midX = (start[0] + end[0]) / 2
      const midY = (start[1] + end[1]) / 2
      const toCenter = new THREE.Vector2(centerX - midX, centerY - midY)
      const dot = normal.dot(toCenter)

      if (dot < 0) {
        normal.negate()
      }
      return normal
    },
    [squarePoints],
  )

  // Функция для получения нормали к стороне (направленной наружу)
  const getOutwardNormal = useCallback(
    (sideIndex: number) => {
      const inwardNormal = getInwardNormal(sideIndex)
      return inwardNormal.negate()
    },
    [getInwardNormal],
  )

  // Вычисляем позиции переключателей сторон (в центре каждой стороны)
  const getSideTogglePositions = useCallback(() => {
    return squarePoints.map((point, index) => {
      const nextPoint = squarePoints[(index + 1) % squarePoints.length]
      return [(point[0] + nextPoint[0]) / 2, (point[1] + nextPoint[1]) / 2, 0.1] as [number, number, number]
    })
  }, [squarePoints])

  const sideTogglePositions = getSideTogglePositions()

  // Вычисляем позиции индикаторов добавления точек (в центре каждой стороны, смещенные наружу)
  const getAddPointIndicatorPositions = useCallback(() => {
    return squarePoints.map((point, index) => {
      const nextPoint = squarePoints[(index + 1) % squarePoints.length]
      const midpoint = new THREE.Vector2((point[0] + nextPoint[0]) / 2, (point[1] + nextPoint[1]) / 2)
      const outwardNormal = getOutwardNormal(index)
      const offsetAmount = stripWidth / 2 + 0.2 // Увеличил смещение для лучшей видимости
      const offsetPoint = midpoint.add(outwardNormal.multiplyScalar(offsetAmount))
      return [offsetPoint.x, offsetPoint.y, 0.1] as [number, number, number] // Z-координата для видимости
    })
  }, [squarePoints, getOutwardNormal, stripWidth])

  const addPointIndicatorPositions = getAddPointIndicatorPositions()



  return (
    <>
      {/* Освещение */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow />

      {/* Плоскость основания */}
      <mesh position={[0, 0, -0.1]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#90EE90" opacity={0.3} transparent />
      </mesh>

      {/* Контур квадрата */}
      <primitive object={new THREE.Line(
        new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([
          ...squarePoints.flat(),
          ...squarePoints[0], // Замыкаем контур
        ], 3)),
        new THREE.LineBasicMaterial({ color: "#333", linewidth: 3 })
      )} />

      {/* Сплошная полоса (дома) */}
      <SolidStrip squarePoints={squarePoints} activeSides={activeSides} stripWidth={stripWidth} />

      {/* Внутренняя оранжевая полоса */}
      <InnerStrip
        squarePoints={squarePoints}
        activeSides={activeSides}
        stripWidth={stripWidth}
        innerStripWidth={orangeStripWidth} // Используем настраиваемую ширину
        innerStripPadding={orangeStripOffset + orangeStripWidth}
      />

      {/* Внешняя оранжевая полоса */}
      <OuterStrip
        squarePoints={squarePoints}
        activeSides={activeSides}
        stripWidth={stripWidth}
        outerStripWidth={orangeStripWidth} // Используем настраиваемую ширину
        outerStripPadding={orangeStripOffset - stripWidth - 0.01} // Простая логика без дополнительных вычитаний
      />

      {/* Зеленый полигон на основе внутренних оранжевых дорог */}
      <GreenPolygon
        squarePoints={squarePoints}
        activeSides={activeSides}
        stripWidth={stripWidth}
        innerStripWidth={orangeStripWidth}
        innerStripPadding={orangeStripOffset + orangeStripWidth}
      />

      {/* Переключатели сторон */}
      {sideTogglePositions.map((position, index) => (
        <SideToggle
          key={index}
          position={position}
          isActive={activeSides[index]}
          onToggle={handleSideToggle}
          sideIndex={index}
        />
      ))}

      {/* Индикаторы добавления точек */}
      {addPointIndicatorPositions.map((position, index) => (
        <AddPointIndicator key={`add-${index}`} position={position} onAddPoint={handleAddPoint} segmentIndex={index} />
      ))}

      {/* Перетаскиваемые точки контура */}
      {squarePoints.map((point, index) => (
        <DraggablePoint
          key={index}
          position={point}
          onDrag={handlePointDrag}
          index={index}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => setIsDragging(false)}
        />
      ))}

      <OrbitControls enablePan={true} enableZoom={true} enableRotate={false} enabled={!isDragging} />
    </>
  )
}

export default function InteractiveSquareEditor() {
  const [squarePoints, setSquarePoints] = useState<[number, number, number][]>([
    [-2, -2, 0], // Левый нижний
    [2, -2, 0], // Правый нижний
    [2, 2, 0], // Правый верхний
    [-2, 2, 0], // Левый верхний
  ])

  // Изначально активна только нижняя сторона
  const [activeSides, setActiveSides] = useState<boolean[]>([true, false, false, false])
  const [stripWidth, setStripWidth] = useState(0.8)
  const [orangeStripOffset, setOrangeStripOffset] = useState(0) // Общий отступ оранжевых линий от границы желтой
  const [orangeStripWidth, setOrangeStripWidth] = useState(0.15) // Ширина оранжевой полосы

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Панель управления */}
      <div className="p-4 bg-gray-100 flex gap-4 items-center flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Ширина полосы:</label>
          <input
            type="range"
            min="0.3"
            max="1.5"
            step="0.1"
            value={stripWidth}
            onChange={(e) => setStripWidth(Number.parseFloat(e.target.value))}
            className="w-32"
          />
          <span className="text-sm text-gray-600 w-8">{stripWidth}</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Отступ оранжевых линий:</label>
          <input
            type="range"
            min="0"
            max="0.5"
            step="0.05"
            value={orangeStripOffset}
            onChange={(e) => setOrangeStripOffset(Number.parseFloat(e.target.value))}
            className="w-32"
          />
          <span className="text-sm text-gray-600 w-8">{orangeStripOffset}</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Ширина оранжевой полосы:</label>
          <input
            type="range"
            min="0.05"
            max="0.5"
            step="0.05"
            value={orangeStripWidth}
            onChange={(e) => setOrangeStripWidth(Number.parseFloat(e.target.value))}
            className="w-32"
          />
          <span className="text-sm text-gray-600 w-8">{orangeStripWidth}</span>
        </div>

        <div className="text-sm text-gray-600">
          <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span>
          Активная сторона
          <span className="inline-block w-3 h-3 bg-red-500 rounded-full mr-2 ml-4"></span>
          Неактивная сторона
          <span className="inline-block w-3 h-3 bg-white border border-gray-400 rounded-sm flex items-center justify-center text-xs font-bold text-gray-800 mr-2 ml-4">
            +
          </span>
          Добавить точку
          <span className="inline-block w-3 h-3 bg-orange-500 rounded-full mr-2 ml-4"></span>
          Оранжевые дороги
          <span className="inline-block w-3 h-3 bg-green-400 rounded-full mr-2 ml-4"></span>
          Зеленый полигон
        </div>

        <div className="ml-auto text-sm text-gray-600 flex items-center">
          Голубые точки - контур | Цветные точки - включение/выключение сторон
        </div>
      </div>

      {/* 3D сцена */}
      <div className="flex-1">
        <Canvas 
          camera={{ position: [0, 0, 8], fov: 50 }} 
          shadows
          gl={{ 
            antialias: true,
            preserveDrawingBuffer: false,
            powerPreference: "high-performance"
          }}
        >
                  <Scene
          squarePoints={squarePoints}
          setSquarePoints={setSquarePoints}
          activeSides={activeSides}
          setActiveSides={setActiveSides}
          stripWidth={stripWidth}
          orangeStripOffset={orangeStripOffset}
          orangeStripWidth={orangeStripWidth}
        />
        </Canvas>
      </div>
    </div>
  )
}
