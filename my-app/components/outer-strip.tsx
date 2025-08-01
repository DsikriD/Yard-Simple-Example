"use client"

import React, { useRef, useCallback } from "react"
import * as THREE from "three"


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

export function OuterStrip({
  squarePoints,
  activeSides,
  stripWidth, // Ширина основной желтой полосы
  outerStripWidth, // Ширина внешней оранжевой полосы
  outerStripPadding, // Отступ внешней оранжевой полосы от внешней границы желтой
}: {
  squarePoints: [number, number, number][]
  activeSides: boolean[]
  stripWidth: number
  outerStripWidth: number
  outerStripPadding: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  const generateStripGeometry = useCallback(() => {
    const vertices: number[] = []
    const indices: number[] = []
    let vertexIndex = 0
    const numPoints = squarePoints.length

    // Функция для получения нормали к стороне (направленной наружу)
    const getOutwardNormal = (sideIndex: number) => {
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

      if (dot > 0) {
        normal.negate() // Разворачиваем нормаль, если она смотрит внутрь
      }

      return normal
    }

    // Правильные смещения для внешней оранжевой полосы
    // Внешняя оранжевая полоса должна быть снаружи желтой полосы
    // При outerStripPadding = 0 полоса должна касаться внешней границы желтой полосы
    const outerOffsetOrange = stripWidth + outerStripPadding + outerStripWidth // Внешний край внешней оранжевой полосы
    const innerOffsetOrange = stripWidth + outerStripPadding // Внутренний край внешней оранжевой полосы

    // Pre-calculate outer and inner points for all corners of the orange strip
    const calculatedOuterPoints: THREE.Vector2[] = new Array(numPoints).fill(null)
    const calculatedInnerPoints: THREE.Vector2[] = new Array(numPoints).fill(null)

    for (let k = 0; k < numPoints; k++) {
      const pCurr = new THREE.Vector2(squarePoints[k][0], squarePoints[k][1])
      const pPrev = new THREE.Vector2(
        squarePoints[(k - 1 + numPoints) % numPoints][0],
        squarePoints[(k - 1 + numPoints) % numPoints][1],
      )
      const pNext = new THREE.Vector2(squarePoints[(k + 1) % numPoints][0], squarePoints[(k + 1) % numPoints][1])

      const isPrevSideActive = activeSides[(k - 1 + numPoints) % numPoints]
      const isCurrSideActive = activeSides[k]

      const normalPrev = getOutwardNormal((k - 1 + numPoints) % numPoints)
      const normalCurr = getOutwardNormal(k)

      // Calculate outer edge of external orange strip
      if (isPrevSideActive && isCurrSideActive) {
        // Both sides active: calculate intersection
        const offsetLine1_outer_p1 = pPrev.clone().add(normalPrev.clone().multiplyScalar(outerOffsetOrange))
        const offsetLine1_outer_p2 = pCurr.clone().add(normalPrev.clone().multiplyScalar(outerOffsetOrange))
        const offsetLine2_outer_p1 = pCurr.clone().add(normalCurr.clone().multiplyScalar(outerOffsetOrange))
        const offsetLine2_outer_p2 = pNext.clone().add(normalCurr.clone().multiplyScalar(outerOffsetOrange))

        const intersectionOuter = lineLineIntersection(
          offsetLine1_outer_p1.toArray() as [number, number],
          offsetLine1_outer_p2.toArray() as [number, number],
          offsetLine2_outer_p1.toArray() as [number, number],
          offsetLine2_outer_p2.toArray() as [number, number],
        )

        if (intersectionOuter) {
          calculatedOuterPoints[k] = new THREE.Vector2(intersectionOuter[0], intersectionOuter[1])
        } else {
          calculatedOuterPoints[k] = pCurr.clone().add(normalCurr.clone().multiplyScalar(outerOffsetOrange))
        }
      } else if (isCurrSideActive) {
        // Only current side active
        calculatedOuterPoints[k] = pCurr.clone().add(normalCurr.clone().multiplyScalar(outerOffsetOrange))
      } else if (isPrevSideActive) {
        // Only previous side active
        calculatedOuterPoints[k] = pCurr.clone().add(normalPrev.clone().multiplyScalar(outerOffsetOrange))
      } else {
        // Neither side active
        calculatedOuterPoints[k] = pCurr.clone()
      }

      // Calculate inner edge of external orange strip
      if (isPrevSideActive && isCurrSideActive) {
        // Both sides active: calculate intersection
        const offsetLine1_inner_p1 = pPrev.clone().add(normalPrev.clone().multiplyScalar(innerOffsetOrange))
        const offsetLine1_inner_p2 = pCurr.clone().add(normalPrev.clone().multiplyScalar(innerOffsetOrange))
        const offsetLine2_inner_p1 = pCurr.clone().add(normalCurr.clone().multiplyScalar(innerOffsetOrange))
        const offsetLine2_inner_p2 = pNext.clone().add(normalCurr.clone().multiplyScalar(innerOffsetOrange))

        const intersectionInner = lineLineIntersection(
          offsetLine1_inner_p1.toArray() as [number, number],
          offsetLine1_inner_p2.toArray() as [number, number],
          offsetLine2_inner_p1.toArray() as [number, number],
          offsetLine2_inner_p2.toArray() as [number, number],
        )

        if (intersectionInner) {
          calculatedInnerPoints[k] = new THREE.Vector2(intersectionInner[0], intersectionInner[1])
        } else {
          calculatedInnerPoints[k] = pCurr.clone().add(normalCurr.clone().multiplyScalar(innerOffsetOrange))
        }
      } else if (isCurrSideActive) {
        // Only current side active
        calculatedInnerPoints[k] = pCurr.clone().add(normalCurr.clone().multiplyScalar(innerOffsetOrange))
      } else if (isPrevSideActive) {
        // Only previous side active
        calculatedInnerPoints[k] = pCurr.clone().add(normalPrev.clone().multiplyScalar(innerOffsetOrange))
      } else {
        // Neither side active
        calculatedInnerPoints[k] = pCurr.clone()
      }
    }

    // Generate strips for each active side
    for (let i = 0; i < numPoints; i++) {
      if (!activeSides[i]) continue // Skip inactive sides

      // Outer points of the external orange strip
      const outerStart = calculatedOuterPoints[i]
      const outerEnd = calculatedOuterPoints[(i + 1) % numPoints]

      // Inner points of the external orange strip
      const innerStart = calculatedInnerPoints[i]
      const innerEnd = calculatedInnerPoints[(i + 1) % numPoints]

      // Add vertices for the rectangle (outerStart, outerEnd, innerEnd, innerStart)
      vertices.push(
        outerStart.x,
        outerStart.y,
        0.02, // Z slightly above inner orange strip
        outerEnd.x,
        outerEnd.y,
        0.02,
        innerEnd.x,
        innerEnd.y,
        0.02,
        innerStart.x,
        innerStart.y,
        0.02,
      )

      // Add indices for two triangles
      const baseIndex = vertexIndex
      indices.push(
        baseIndex,
        baseIndex + 1,
        baseIndex + 2, // First triangle
        baseIndex,
        baseIndex + 2,
        baseIndex + 3, // Second triangle
      )

      vertexIndex += 4
    }

    // Create geometry
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    return geometry
  }, [squarePoints, activeSides, stripWidth, outerStripWidth, outerStripPadding])

  React.useEffect(() => {
    if (meshRef.current) {
      const newGeometry = generateStripGeometry()
      meshRef.current.geometry.dispose()
      meshRef.current.geometry = newGeometry
    }
  }, [generateStripGeometry])

  return (
    <mesh ref={meshRef} geometry={generateStripGeometry()} position={[0, 0, 0]}>
      <meshStandardMaterial color="#FF8C00" /> {/* Оранжевый цвет */}
    </mesh>
  )
} 