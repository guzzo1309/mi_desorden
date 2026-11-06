import CoreImage
import ExpoModulesCore
import UIKit
import Vision

/**
 Reconocimiento de productos en el teléfono, con Apple Vision (gratis, sin red).

 - huella: la "huella visual" de una imagen (VNFeaturePrintObservation) en base64,
   para guardarla y compararla después. Antes de calcularla se aísla el objeto del
   fondo (máscara de primer plano de Vision, iOS 17+): el escritorio, las luces o
   las manos de atrás no cuentan. Si no se puede aislar, se usa la imagen entera.
 - analizar: la distancia de una foto nueva a cada huella de referencia (menor =
   más parecida) y el texto que se lee en la foto (marca, nombre, tamaño).
 - leerTexto: cada pedazo de texto de una foto (una factura) con su caja, para
   rearmar las filas en JS (lib/factura.ts).
 */
public class ReconocerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Reconocer")

    // Cambia cada vez que cambia cómo se calcula la huella (las guardadas dejan de servir).
    Constants(["huellaVersion": 2])

    AsyncFunction("huella") { (uri: String) -> String in
      let imagen = try cargarImagen(uri)
      let huella = try huellaDe(imagen)
      let datos = try NSKeyedArchiver.archivedData(withRootObject: huella, requiringSecureCoding: true)
      return datos.base64EncodedString()
    }

    AsyncFunction("analizar") { (uri: String, referencias: [String: String]) -> [String: Any] in
      let imagen = try cargarImagen(uri)
      let huella = try huellaDe(imagen)

      var distancias: [String: Double] = [:]
      for (id, base64) in referencias {
        guard
          let datos = Data(base64Encoded: base64),
          let referencia = try? NSKeyedUnarchiver.unarchivedObject(
            ofClass: VNFeaturePrintObservation.self, from: datos)
        else { continue }
        var distancia: Float = 0
        // Huellas de otra versión de Vision no se pueden comparar: se saltean.
        if (try? huella.computeDistance(&distancia, to: referencia)) != nil {
          distancias[id] = Double(distancia)
        }
      }
      return ["distancias": distancias, "textos": try textosDe(imagen)]
    }

    AsyncFunction("leerTexto") { (uri: String) -> [[String: Any]] in
      let imagen = try cargarImagen(uri)
      let pedido = VNRecognizeTextRequest()
      pedido.recognitionLevel = .accurate
      pedido.recognitionLanguages = ["es-ES", "en-US"]
      // Sin corrección: los nombres de productos y las marcas no son palabras del diccionario.
      pedido.usesLanguageCorrection = false
      try VNImageRequestHandler(cgImage: imagen.cg, orientation: imagen.orientacion).perform([pedido])
      // Palabra por palabra, cada una con su caja: en una tabla (Cantidad | Descripción |
      // Precio) Vision a veces junta columnas o apila una columna entera en un solo
      // pedazo, y así se puede rearmar cada fila por posición.
      return (pedido.results ?? []).flatMap { observacion -> [[String: Any]] in
        guard let candidato = observacion.topCandidates(1).first else { return [] }
        return palabrasConCaja(candidato, de: observacion)
      }
    }
  }
}

/// Cada palabra del texto reconocido con su caja (Vision mide desde abajo a la izquierda,
/// de 0 a 1; JS espera desde arriba). Si una palabra no tiene caja propia, usa la de la línea.
private func palabrasConCaja(
  _ candidato: VNRecognizedText, de observacion: VNRecognizedTextObservation
) -> [[String: Any]] {
  let texto = candidato.string
  func registro(_ palabra: String, _ caja: CGRect) -> [String: Any] {
    [
      "texto": palabra,
      "x": Double(caja.minX),
      "y": Double(1 - caja.maxY),
      "ancho": Double(caja.width),
      "alto": Double(caja.height),
    ]
  }

  var resultado: [[String: Any]] = []
  var inicio: String.Index?
  func cerrar(_ fin: String.Index) {
    guard let desde = inicio else { return }
    inicio = nil
    let rango = desde..<fin
    let caja = (try? candidato.boundingBox(for: rango))?.boundingBox ?? observacion.boundingBox
    resultado.append(registro(String(texto[rango]), caja))
  }
  for i in texto.indices {
    if texto[i].isWhitespace { cerrar(i) } else if inicio == nil { inicio = i }
  }
  cerrar(texto.endIndex)
  return resultado
}

private struct Imagen {
  let cg: CGImage
  let orientacion: CGImagePropertyOrientation
}

/// Archivo local (file://, lo que devuelve la cámara) o https (URL firmada de Storage).
/// La imagen se devuelve ya derecha (orientación .up): todo lo que sigue la procesa igual.
private func cargarImagen(_ uri: String) throws -> Imagen {
  guard let url = URL(string: uri) else { throw ImagenInvalida() }
  let datos = try Data(contentsOf: url)
  guard let ui = UIImage(data: datos), let cg = derecha(ui).cgImage else { throw ImagenInvalida() }
  return Imagen(cg: cg, orientacion: .up)
}

/// Aplica la orientación de la foto a los píxeles (la cámara guarda las fotos "acostadas").
private func derecha(_ ui: UIImage) -> UIImage {
  if ui.imageOrientation == .up { return ui }
  let formato = UIGraphicsImageRendererFormat.default()
  formato.scale = ui.scale
  return UIGraphicsImageRenderer(size: ui.size, format: formato).image { _ in
    ui.draw(in: CGRect(origin: .zero, size: ui.size))
  }
}

private let contextoCI = CIContext()

/// Recorta el objeto principal y lo pone sobre un gris neutro. Devuelve nil si no
/// hay un objeto claro (o el sistema es anterior a iOS 17): ahí se usa la imagen entera.
private func aislarObjeto(_ imagen: Imagen) -> Imagen? {
  guard #available(iOS 17.0, *) else { return nil }
  let manejador = VNImageRequestHandler(cgImage: imagen.cg, orientation: imagen.orientacion)
  let pedido = VNGenerateForegroundInstanceMaskRequest()
  guard (try? manejador.perform([pedido])) != nil,
    let resultado = pedido.results?.first,
    !resultado.allInstances.isEmpty
  else { return nil }

  // El objeto que está en el centro de la foto; si el centro es fondo, todos.
  let elegidas = instanciaCentral(resultado) ?? resultado.allInstances
  guard
    let buffer = try? resultado.generateMaskedImage(
      ofInstances: elegidas, from: manejador, croppedToInstancesExtent: true)
  else { return nil }

  let recorte = CIImage(cvPixelBuffer: buffer)
  let gris = CIImage(color: CIColor(red: 0.5, green: 0.5, blue: 0.5)).cropped(to: recorte.extent)
  let compuesta = recorte.composited(over: gris)
  guard let cg = contextoCI.createCGImage(compuesta, from: compuesta.extent) else { return nil }

  // Si lo aislado es una mota diminuta, la máscara se equivocó: mejor la imagen entera.
  let areaOriginal = imagen.cg.width * imagen.cg.height
  guard cg.width * cg.height * 25 >= areaOriginal else { return nil }
  return Imagen(cg: cg, orientacion: .up)
}

/// Etiqueta de instancia en el centro de la foto (o la más cercana al centro).
@available(iOS 17.0, *)
private func instanciaCentral(_ resultado: VNInstanceMaskObservation) -> IndexSet? {
  let mascara = resultado.instanceMask
  CVPixelBufferLockBaseAddress(mascara, .readOnly)
  defer { CVPixelBufferUnlockBaseAddress(mascara, .readOnly) }
  guard let base = CVPixelBufferGetBaseAddress(mascara) else { return nil }
  let ancho = CVPixelBufferGetWidth(mascara)
  let alto = CVPixelBufferGetHeight(mascara)
  let bytesPorFila = CVPixelBufferGetBytesPerRow(mascara)

  func etiqueta(_ x: Int, _ y: Int) -> UInt8 {
    guard x >= 0, y >= 0, x < ancho, y < alto else { return 0 }
    return base.load(fromByteOffset: y * bytesPorFila + x, as: UInt8.self)
  }

  let cx = ancho / 2
  let cy = alto / 2
  let paso = max(4, min(ancho, alto) / 40)
  var radio = 0
  while radio <= min(ancho, alto) / 2 {
    for (dx, dy) in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)] {
      let e = etiqueta(cx + dx * radio, cy + dy * radio)
      if e != 0 { return IndexSet(integer: Int(e)) }
    }
    radio += paso
  }
  return nil
}

private func huellaDe(_ imagen: Imagen) throws -> VNFeaturePrintObservation {
  // Referencias y foto nueva se aíslan igual, así se comparan objeto contra objeto.
  let objeto = aislarObjeto(imagen) ?? imagen
  let pedido = VNGenerateImageFeaturePrintRequest()
  pedido.imageCropAndScaleOption = .centerCrop
  try VNImageRequestHandler(cgImage: objeto.cg, orientation: objeto.orientacion).perform([pedido])
  guard let huella = pedido.results?.first else { throw SinHuella() }
  return huella
}

private func textosDe(_ imagen: Imagen) throws -> [String] {
  let pedido = VNRecognizeTextRequest()
  pedido.recognitionLevel = .accurate
  pedido.recognitionLanguages = ["es-ES", "en-US"]
  pedido.usesLanguageCorrection = true
  try VNImageRequestHandler(cgImage: imagen.cg, orientation: imagen.orientacion).perform([pedido])
  return (pedido.results ?? []).compactMap { $0.topCandidates(1).first?.string }
}

private final class ImagenInvalida: Exception, @unchecked Sendable {
  override var reason: String { "No se pudo leer la imagen" }
}

private final class SinHuella: Exception, @unchecked Sendable {
  override var reason: String { "No se pudo analizar la imagen" }
}

extension CGImagePropertyOrientation {
  init(_ o: UIImage.Orientation) {
    switch o {
    case .up: self = .up
    case .down: self = .down
    case .left: self = .left
    case .right: self = .right
    case .upMirrored: self = .upMirrored
    case .downMirrored: self = .downMirrored
    case .leftMirrored: self = .leftMirrored
    case .rightMirrored: self = .rightMirrored
    @unknown default: self = .up
    }
  }
}
