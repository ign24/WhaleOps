## ADDED Requirements

### Requirement: Banner hero con identidad visual WhaleOps
El sistema SHALL renderizar un banner hero en la parte superior del welcome card que combine un dot-grid background, un radial gradient spotlight y una mascota SVG de ballena con el título y estado del agente integrados.

#### Scenario: Banner visible en welcome card vacío
- **WHEN** el usuario abre la aplicación y no hay mensajes en el chat
- **THEN** el banner hero aparece en la parte superior del welcome card con la mascota visible y el título "WhaleOps"

#### Scenario: Banner no visible durante conversación activa
- **WHEN** hay mensajes en el chat y el welcome card está desmontado
- **THEN** el banner no es visible en ninguna parte de la UI

### Requirement: Mascota SVG inline con personalidad
El componente SHALL incluir una mascota SVG de ballena definida como paths inline (no imagen externa) con al menos: cuerpo redondeado, ojo con highlight, cola como path separado, y blowhole.

#### Scenario: Mascota renderiza sin HTTP requests adicionales
- **WHEN** el welcome card se monta
- **THEN** la mascota es visible sin ningún request de red adicional para assets

#### Scenario: Mascota respeta el tema light/dark
- **WHEN** el usuario cambia entre tema claro y oscuro
- **THEN** los colores de la mascota (fill, stroke) se actualizan automáticamente usando las CSS vars del tema

### Requirement: Animación de entrada — swim-in
Al montarse el componente, la mascota SHALL animar desde fuera del banner (offset X positivo) hasta su posición final con una transición spring que comunique peso e inercia.

#### Scenario: Whale entra desde la derecha
- **WHEN** el welcome card se monta por primera vez
- **THEN** la mascota aparece translateX desde ~80px fuera de su posición final hasta x:0, con opacity 0→1, usando spring (stiffness ~80, damping ~15)

#### Scenario: Entrada no bloquea el resto del contenido
- **WHEN** la mascota está animando su entrada
- **THEN** el título, badge y stats del banner son visibles y no esperan a que la animación termine

### Requirement: Animación de salida — dive-away
Al desmontarse el componente (usuario envía primer mensaje), la mascota SHALL animar una inmersión (nose-down rotate + translateY hacia abajo + fade) mientras el banner completo sale con la animación del card.

#### Scenario: Whale se sumerge al salir
- **WHEN** el welcome card inicia su exit animation
- **THEN** la mascota rota ~25deg (nose hacia abajo) y se traslada Y +50px con opacity 0→ en ~300ms ease-in, simultáneo con el exit del card

### Requirement: Idle animations — loop continuo
Mientras el banner es visible, la mascota SHALL ejecutar animaciones idle en loop que comuniquen vida sin ser distractoras.

#### Scenario: Float vertical idle
- **WHEN** el banner está visible y sin interacción
- **THEN** la mascota oscila suavemente en Y ±4px con periodo ~3s, ease-in-out, yoyo infinito

#### Scenario: Tail wag idle
- **WHEN** el banner está visible y sin interacción
- **THEN** la cola (path separado) oscila ±8deg con periodo ~1.2s, yoyo infinito

#### Scenario: Blink ocasional
- **WHEN** han pasado ~4 segundos sin blink
- **THEN** el ojo hace scaleY 1→0.1→1 en ~80ms total, luego espera otros ~4s

#### Scenario: Burbujas flotantes
- **WHEN** el banner está visible
- **THEN** 3 burbujas circulares animan opacity 0→1→0 + translateY hacia arriba con stagger de 0.4s entre cada una, en loop infinito

### Requirement: Estilo visual Vercel landing page
El banner SHALL tener un tratamiento visual coherente con el estilo Vercel: surface oscura, dot-grid overlay, radial gradient spotlight centrado en la mascota, y border sutil con gradient.

#### Scenario: Dot-grid visible detrás del contenido
- **WHEN** el banner está visible
- **THEN** el patrón de puntos es visible como capa de fondo detrás del texto y la mascota, usando el componente DotGridBackground existente

#### Scenario: Radial gradient spotlight
- **WHEN** el banner está visible
- **THEN** hay un radial gradient centrado aproximadamente en la zona de la mascota que ilumina el fondo oscuro, implementado como CSS background puro (sin JS)

#### Scenario: Border con gradient sutil
- **WHEN** el banner está visible
- **THEN** el borde del banner tiene un gradient sutil (no color sólido) usando CSS border o outline trick
