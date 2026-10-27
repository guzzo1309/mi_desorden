import ExpoModulesCore
import UIKit
import Vision

/**
 Reconocimiento de productos en el teléfono, con Apple Vision (gratis, sin red).

 - huella: la "huella visual" de una imagen (VNFeaturePrintObservation) en base64,
   para guardarla y compararla después.
 - analizar: la distancia de una foto nueva a cada huella de referencia (menor =
   más parecida) y el texto que se lee en la foto (marca, nombre, tamaño).
 - leerTexto: cada pedazo de texto de una foto (una factura) con su caja, para
   rearmar las filas en JS (lib/factura.ts).
 */
public class ReconocerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Reconocer")

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
      return (pedido.results ?? []).compactMap { observacion -> [String: Any]? in
        guard let texto = observacion.topCandidates(1).first?.string else { return nil }
        // Vision mide desde abajo a la izquierda (0 a 1); JS espera desde arriba.
        let caja = observacion.boundingBox
        return [
          "texto": texto,
          "x": Double(caja.minX),
          "y": Double(1 - caja.maxY),
          "ancho": Double(caja.width),
          "alto": Double(caja.height),
        ]
      }
    }
  }
}

private struct Imagen {
  let cg: CGImage
  let orientacion: CGImagePropertyOrientation
}

/// Archivo local (file://, lo que devuelve la cámara) o https (URL firmada de Storage).
private func cargarImagen(_ uri: String) throws -> Imagen {
  guard let url = URL(string: uri) else { throw ImagenInvalida() }
  let datos = try Data(contentsOf: url)
  guard let ui = UIImage(data: datos), let cg = ui.cgImage else { throw ImagenInvalida() }
  return Imagen(cg: cg, orientacion: CGImagePropertyOrientation(ui.imageOrientation))
}

private func huellaDe(_ imagen: Imagen) throws -> VNFeaturePrintObservation {
  let pedido = VNGenerateImageFeaturePrintRequest()
  pedido.imageCropAndScaleOption = .centerCrop
  try VNImageRequestHandler(cgImage: imagen.cg, orientation: imagen.orientacion).perform([pedido])
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
