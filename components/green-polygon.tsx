"use client"

import React, { useRef, useCallback } from "react"
import * as THREE from "three"
import { SvgShaderMaterialComponent } from "./svg-shader-material"




// Helper function for line-line intersection (reused from main component)
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
    return null // Parallel or collinear
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den
  const ix = x1 + t * (x2 - x1)
  const iy = y1 + t * (y2 - y1)

  return [ix, iy]
}

export function GreenPolygon({
  squarePoints,
  activeSides,
  stripWidth,
  innerStripWidth,
  innerStripPadding,
}: {
  squarePoints: [number, number, number][]
  activeSides: boolean[]
  stripWidth: number
  innerStripWidth: number
  innerStripPadding: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  

  


  const generatePolygonGeometry = useCallback(() => {
    const numPoints = squarePoints.length

    // Функция для получения нормали к стороне (направленной внутрь)
    const getInwardNormal = (sideIndex: number) => {
      const start = squarePoints[sideIndex]
      const end = squarePoints[(sideIndex + 1) % numPoints]
      const sideVec = new THREE.Vector2(end[0] - start[0], end[1] - start[1])
      const normal = new THREE.Vector2(-sideVec.y, sideVec.x).normalize()

      const centerX = squarePoints.reduce((sum, p) => sum + p[0], 0) / numPoints
      const centerY = squarePoints.reduce((sum, p) => sum + p[1], 0) / numPoints
      const midX = (start[0] + end[0]) / 2
      const midY = (start[1] + end[1]) / 2
      const toCenter = new THREE.Vector2(centerX - midX, centerY - midY)
      const dot = normal.dot(toCenter)

      if (dot < 0) {
        normal.negate()
      }
      return normal
    }

    // Вычисляем точки внутреннего контура оранжевых дорог
    const innerContourPoints: THREE.Vector2[] = []

    for (let k = 0; k < numPoints; k++) {
      const pCurr = new THREE.Vector2(squarePoints[k][0], squarePoints[k][1])
      const pPrev = new THREE.Vector2(
        squarePoints[(k - 1 + numPoints) % numPoints][0],
        squarePoints[(k - 1 + numPoints) % numPoints][1],
      )
      const pNext = new THREE.Vector2(squarePoints[(k + 1) % numPoints][0], squarePoints[(k + 1) % numPoints][1])

      const isPrevSideActive = activeSides[(k - 1 + numPoints) % numPoints]
      const isCurrSideActive = activeSides[k]

      const normalPrev = getInwardNormal((k - 1 + numPoints) % numPoints)
      const normalCurr = getInwardNormal(k)

      if (isPrevSideActive && isCurrSideActive) {
        // Both sides active: calculate intersection
        const offsetLine1_p1 = pPrev.clone().add(normalPrev.clone().multiplyScalar(stripWidth + innerStripPadding + innerStripWidth))
        const offsetLine1_p2 = pCurr.clone().add(normalPrev.clone().multiplyScalar(stripWidth + innerStripPadding + innerStripWidth))
        const offsetLine2_p1 = pCurr.clone().add(normalCurr.clone().multiplyScalar(stripWidth + innerStripPadding + innerStripWidth))
        const offsetLine2_p2 = pNext.clone().add(normalCurr.clone().multiplyScalar(stripWidth + innerStripPadding + innerStripWidth))

        const intersection = lineLineIntersection(
          offsetLine1_p1.toArray() as [number, number],
          offsetLine1_p2.toArray() as [number, number],
          offsetLine2_p1.toArray() as [number, number],
          offsetLine2_p2.toArray() as [number, number],
        )

        if (intersection) {
          innerContourPoints.push(new THREE.Vector2(intersection[0], intersection[1]))
        } else {
          innerContourPoints.push(pCurr.clone().add(normalCurr.clone().multiplyScalar(stripWidth + innerStripPadding + innerStripWidth)))
        }
      } else if (isCurrSideActive) {
        // Only current side active
        innerContourPoints.push(pCurr.clone().add(normalCurr.clone().multiplyScalar(stripWidth + innerStripPadding + innerStripWidth)))
      } else if (isPrevSideActive) {
        // Only previous side active
        innerContourPoints.push(pCurr.clone().add(normalPrev.clone().multiplyScalar(stripWidth + innerStripPadding + innerStripWidth)))
      } else {
        // Neither side active - не добавляем точку
        continue
      }
    }

    // Если точек меньше 3, не строим полигон
    if (innerContourPoints.length < 3) {
      console.log("Недостаточно точек для полигона:", innerContourPoints.length)
      return new THREE.BufferGeometry()
    }

    // Создаем полигон из точек внутреннего контура
    const vertices: number[] = []
    const indices: number[] = []
    const uvs: number[] = []

    // Добавляем все точки полигона
    for (let i = 0; i < innerContourPoints.length; i++) {
      const point = innerContourPoints[i]
      vertices.push(point.x, point.y, 0.05) // Уменьшили Z-координату для избежания Z-fighting
      
      // Добавляем UV координаты (используем мировые координаты для статичного паттерна)
      const u = point.x * 2.0 // Масштабируем X координату
      const v = point.y * 2.0 // Масштабируем Y координату
      uvs.push(u, v)
    }

    // Создаем треугольники для полигона (веерная триангуляция от центра)
    const centerX = innerContourPoints.reduce((sum, p) => sum + p.x, 0) / innerContourPoints.length
    const centerY = innerContourPoints.reduce((sum, p) => sum + p.y, 0) / innerContourPoints.length
    
    // Добавляем центральную точку
    vertices.push(centerX, centerY, 0.05)
    uvs.push(centerX * 2.0, centerY * 2.0) // UV координаты для центра
    const centerIndex = innerContourPoints.length

    // Создаем треугольники от центра к каждой паре соседних точек
    for (let i = 0; i < innerContourPoints.length; i++) {
      const nextIndex = (i + 1) % innerContourPoints.length
      indices.push(centerIndex, i, nextIndex)
    }

    // Создаем геометрию
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    return geometry
  }, [squarePoints, activeSides, stripWidth, innerStripWidth, innerStripPadding])

  React.useEffect(() => {
    if (meshRef.current) {
      const newGeometry = generatePolygonGeometry()
      meshRef.current.geometry.dispose()
      meshRef.current.geometry = newGeometry
    }
  }, [generatePolygonGeometry])

  return (
    <mesh ref={meshRef} geometry={generatePolygonGeometry()} position={[0, 0, 0]}>
      <SvgShaderMaterialComponent />
    </mesh>
  )
} 