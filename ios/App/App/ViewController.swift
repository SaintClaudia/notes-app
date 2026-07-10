import Capacitor

// Subclasses CAPBridgeViewController solely to register CloudKitSyncPlugin —
// a local plugin (not an npm package) has no other registration hook.
// Wired in as Main.storyboard's root view controller's custom class.
class ViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(CloudKitSyncPlugin())
    }
}
