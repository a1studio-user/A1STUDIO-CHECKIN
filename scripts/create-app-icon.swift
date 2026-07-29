import AppKit
import ImageIO
import UniformTypeIdentifiers

let outputPath = CommandLine.arguments.dropFirst().first ?? "frontend/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
let size = 1024

guard let context = CGContext(
    data: nil,
    width: size,
    height: size,
    bitsPerComponent: 8,
    bytesPerRow: size * 4,
    space: CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
) else {
    fatalError("Unable to create graphics context")
}

let stripeWidth = CGFloat(size) / 3
context.setFillColor(CGColor(red: 0.0, green: 0.56, blue: 0.27, alpha: 1.0))
context.fill(CGRect(x: 0, y: 0, width: stripeWidth, height: CGFloat(size)))

context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1.0))
context.fill(CGRect(x: stripeWidth, y: 0, width: stripeWidth, height: CGFloat(size)))

context.setFillColor(CGColor(red: 0.81, green: 0.16, blue: 0.20, alpha: 1.0))
context.fill(CGRect(x: stripeWidth * 2, y: 0, width: CGFloat(size) - stripeWidth * 2, height: CGFloat(size)))

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)

let text = "A1" as NSString
let font = NSFont(name: "HelveticaNeue-CondensedBlack", size: 330) ?? NSFont.boldSystemFont(ofSize: 330)
let attributes: [NSAttributedString.Key: Any] = [
    .font: font,
    .foregroundColor: NSColor.black
]
let textSize = text.size(withAttributes: attributes)
let textRect = NSRect(
    x: (CGFloat(size) - textSize.width) / 2,
    y: (CGFloat(size) - textSize.height) / 2,
    width: textSize.width,
    height: textSize.height
)
text.draw(in: textRect, withAttributes: attributes)

NSGraphicsContext.restoreGraphicsState()

guard let image = context.makeImage() else { fatalError("Unable to create image") }
let url = URL(fileURLWithPath: outputPath)
guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    fatalError("Unable to create image destination")
}

CGImageDestinationAddImage(destination, image, nil)
guard CGImageDestinationFinalize(destination) else { fatalError("Unable to write PNG") }
print("Wrote app icon: \(outputPath)")
