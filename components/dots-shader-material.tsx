"use client"

import React from "react"
import * as THREE from "three"

// Вершинный шейдер
const vertexShader = `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Фрагментный шейдер с узором елочек
const fragmentShader = `
  varying vec2 vUv;
  
  void main() {
    // Используем мировые координаты для статичного паттерна
    vec2 worldPos = vUv * 6.0; // Масштабируем для оптимального размера
    
    // Расстояние между елочками
    float spacing = 1.0;
    
    // Создаем сетку для елочек (используем мировые координаты)
    vec2 grid = fract(worldPos / spacing);
    
    // Центр каждой ячейки
    vec2 center = vec2(0.5, 0.5);
    vec2 pos = grid - center;
    
    // Создаем реалистичную елку
    float tree = 0.0;
    
    // Ствол елочки (маленький прямоугольник внизу)
    float trunk = smoothstep(0.03, 0.0, abs(pos.x)) * smoothstep(0.4, 0.0, pos.y + 0.4);
    
    // Иголки елочки (создаем более естественную форму)
    float needles = 0.0;
    
    // Основная форма елки (конус)
    float cone = smoothstep(0.35, 0.0, abs(pos.x) + pos.y * 1.5);
    
    // Добавляем детали иголок
    float detail1 = smoothstep(0.25, 0.0, abs(pos.x + sin(pos.y * 10.0) * 0.05) + pos.y * 1.8);
    float detail2 = smoothstep(0.2, 0.0, abs(pos.x + sin(pos.y * 15.0) * 0.03) + pos.y * 2.0);
    float detail3 = smoothstep(0.15, 0.0, abs(pos.x + sin(pos.y * 20.0) * 0.02) + pos.y * 2.2);
    
    // Объединяем все детали
    needles = max(cone, max(detail1, max(detail2, detail3)));
    
    // Объединяем ствол и иголки
    tree = max(trunk, needles);
    
    // Основной цвет (светло-зеленый)
    vec3 baseColor = vec3(0.56, 0.93, 0.56); // #90EE90
    // Цвет елочки (темно-зеленый)
    vec3 treeColor = vec3(0.1, 0.5, 0.1);
    
    // Смешиваем цвета
    vec3 finalColor = mix(baseColor, treeColor, tree);
    
    gl_FragColor = vec4(finalColor, 0.8);
  }
`

export function DotsShaderMaterial() {
  return (
    <shaderMaterial
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      transparent={true}
      side={THREE.DoubleSide}
    />
  )
} 