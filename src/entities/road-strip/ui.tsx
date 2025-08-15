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

export function RoadStrip({
  squarePoints,
  activeSides,
  stripWidth,
  roadWidth,
  roadPadding,
}: {
  squarePoints: [number, number, number][]
  activeSides: boolean[]
  stripWidth: number
  roadWidth: number
  roadPadding: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  const generateRoadGeometry = useCallback(() => {
    const vertices: number[] = []
    const indices: number[] = []
    let vertexIndex = 0
    const numPoints = squarePoints.length

    // Function to get inward normal (reused from SolidStrip)
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

    // Function to get the road's offset vector for a given side
    const getRoadOffsetVector = (sideIndex: number, isActiveYellowStrip: boolean) => {
      const inwardNormal = getInwardNormal(sideIndex)
      const offsetDist = isActiveYellowStrip
        ? stripWidth + roadPadding + roadWidth / 2 // Road is inside yellow strip
        : roadPadding + roadWidth / 2 // Road is outside contour

      return isActiveYellowStrip
        ? inwardNormal.clone().multiplyScalar(offsetDist)
        : inwardNormal.clone().negate().multiplyScalar(offsetDist)
    }

    // Pre-calculate road centerline points for each corner
    const roadCenterlinePoints: THREE.Vector2[] = new Array(numPoints).fill(null)

    for (let k = 0; k < numPoints; k++) {
      const pCurr = new THREE.Vector2(squarePoints[k][0], squarePoints[k][1])
      const pPrev = new THREE.Vector2(
        squarePoints[(k - 1 + numPoints) % numPoints][0],
        squarePoints[(k - 1 + numPoints) % numPoints][1],
      )
      const pNext = new THREE.Vector2(squarePoints[(k + 1) % numPoints][0], squarePoints[(k + 1) % numPoints][1])

      const isPrevSideActive = activeSides[(k - 1 + numPoints) % numPoints]
      const isCurrSideActive = activeSides[k]

      // Calculate offset lines for intersection
      const offsetVecPrev = getRoadOffsetVector((k - 1 + numPoints) % numPoints, isPrevSideActive)
      const offsetVecCurr = getRoadOffsetVector(k, isCurrSideActive)

      const offsetLine1_p1 = pPrev.clone().add(offsetVecPrev)
      const offsetLine1_p2 = pCurr.clone().add(offsetVecPrev)
      const offsetLine2_p1 = pCurr.clone().add(offsetVecCurr)
      const offsetLine2_p2 = pNext.clone().add(offsetVecCurr)

      const intersection = lineLineIntersection(
        offsetLine1_p1.toArray() as [number, number],
        offsetLine1_p2.toArray() as [number, number],
        offsetLine2_p1.toArray() as [number, number],
        offsetLine2_p2.toArray() as [number, number],
      )

      if (intersection) {
        roadCenterlinePoints[k] = new THREE.Vector2(intersection[0], intersection[1])
      } else {
        // Fallback for parallel lines or no intersection: use a simple offset from pCurr
        // This case should be rare with proper polygon shapes
        roadCenterlinePoints[k] = pCurr.clone().add(offsetVecCurr)
      }
    }

    // Generate main road segments
    for (let i = 0; i < numPoints; i++) {
      const centerStart = roadCenterlinePoints[i]
      const centerEnd = roadCenterlinePoints[(i + 1) % numPoints]

      const segmentVec = centerEnd.clone().sub(centerStart).normalize()
      const perpVec = new THREE.Vector2(-segmentVec.y, segmentVec.x).multiplyScalar(roadWidth / 2)

      const v1 = centerStart.clone().add(perpVec)
      const v2 = centerEnd.clone().add(perpVec)
      const v3 = centerEnd.clone().sub(perpVec)
      const v4 = centerStart.clone().sub(perpVec)

      vertices.push(
        v1.x,
        v1.y,
        0.005, // Z slightly above plane, below yellow strip
        v2.x,
        v2.y,
        0.005,
        v3.x,
        v3.y,
        0.005,
        v4.x,
        v4.y,
        0.005,
      )
      const baseIndex = vertexIndex
      indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3)
      vertexIndex += 4
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
  }, [squarePoints, activeSides, stripWidth, roadWidth, roadPadding])

  React.useEffect(() => {
    if (meshRef.current) {
      const newGeometry = generateRoadGeometry()
      meshRef.current.geometry.dispose()
      meshRef.current.geometry = newGeometry
    }
  }, [generateRoadGeometry])

  return (
    <mesh ref={meshRef} geometry={generateRoadGeometry()} position={[0, 0, 0]}>
      <meshStandardMaterial color="#FF0000" /> {/* Красный цвет для дороги */}
    </mesh>
  )
}
