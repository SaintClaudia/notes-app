import Foundation
import Capacitor
import CloudKit

// Bridges src/app.jsx's cloudKitAdapter to the user's private CloudKit database.
// One CKRecord per note ("Note" type, recordName == note.id) plus a single
// singleton "Categories" record. Registered via packageClassList in
// capacitor.config.json (this is a local plugin, not an npm package).
@objc(CloudKitSyncPlugin)
public class CloudKitSyncPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CloudKitSyncPlugin"
    public let jsName = "CloudKitSync"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "saveNote", returnType: "promise"),
        CAPPluginMethod(name: "deleteNote", returnType: "promise"),
        CAPPluginMethod(name: "fetchAllNotes", returnType: "promise"),
        CAPPluginMethod(name: "saveCategories", returnType: "promise"),
        CAPPluginMethod(name: "fetchCategories", returnType: "promise"),
    ]

    private let noteRecordType = "Note"
    private let categoriesRecordType = "Categories"
    private let categoriesRecordID = CKRecord.ID(recordName: "categories_singleton")
    private var database: CKDatabase { CKContainer.default().privateCloudDatabase }

    @objc func saveNote(_ call: CAPPluginCall) {
        guard let noteJson = call.getString("noteJson"),
              let data = noteJson.data(using: .utf8),
              let note = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let id = note["id"] as? String else {
            call.reject("Invalid note payload")
            return
        }

        let recordID = CKRecord.ID(recordName: id)
        database.fetch(withRecordID: recordID) { [weak self] existing, fetchError in
            guard let self = self else { return }
            if let fetchError = fetchError, (fetchError as? CKError)?.code != .unknownItem {
                call.reject("CloudKit fetch-before-save failed", nil, fetchError)
                return
            }
            let record = existing ?? CKRecord(recordType: self.noteRecordType, recordID: recordID)
            // System field `recordName` isn't queryable by default in a fresh CloudKit
            // schema (unlike custom fields, which are auto-queryable) — so fetchAllNotes
            // queries on this explicit field instead of the implicit "match everything".
            record["kind"] = "note" as CKRecordValue
            record["title"] = (note["title"] as? String ?? "") as CKRecordValue
            record["tagsJSON"] = (CloudKitSyncPlugin.jsonString(note["tags"]) ?? "[]") as CKRecordValue
            record["blocksJSON"] = (CloudKitSyncPlugin.jsonString(note["blocks"]) ?? "[]") as CKRecordValue
            record["pinned"] = ((note["pinned"] as? Bool ?? false) ? 1 : 0) as CKRecordValue
            record["archived"] = ((note["archived"] as? Bool ?? false) ? 1 : 0) as CKRecordValue
            record["private"] = ((note["private"] as? Bool ?? false) ? 1 : 0) as CKRecordValue
            record["updatedAt"] = (note["updatedAt"] as? Double ?? Date().timeIntervalSince1970 * 1000) as CKRecordValue

            self.database.save(record) { _, saveError in
                if let saveError = saveError {
                    call.reject("CloudKit save failed", nil, saveError)
                } else {
                    call.resolve()
                }
            }
        }
    }

    @objc func deleteNote(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("Missing id")
            return
        }
        let recordID = CKRecord.ID(recordName: id)
        database.delete(withRecordID: recordID) { _, error in
            if let error = error, (error as? CKError)?.code != .unknownItem {
                call.reject("CloudKit delete failed", nil, error)
            } else {
                call.resolve()
            }
        }
    }

    @objc func fetchAllNotes(_ call: CAPPluginCall) {
        let query = CKQuery(recordType: noteRecordType, predicate: NSPredicate(format: "kind == %@", "note"))
        var notes: [[String: Any]] = []

        let operation = CKQueryOperation(query: query)
        operation.recordMatchedBlock = { _, result in
            if case .success(let record) = result {
                notes.append(CloudKitSyncPlugin.noteDict(from: record))
            }
        }
        operation.queryResultBlock = { result in
            switch result {
            case .success:
                call.resolve(["notesJson": CloudKitSyncPlugin.jsonString(notes) ?? "[]"])
            case .failure(let error):
                // An unset/empty container returns unknownItem-style errors on first use — treat as empty.
                if (error as? CKError)?.code == .unknownItem {
                    call.resolve(["notesJson": "[]"])
                } else {
                    call.reject("CloudKit fetch failed", nil, error)
                }
            }
        }
        database.add(operation)
    }

    @objc func saveCategories(_ call: CAPPluginCall) {
        guard let categoriesJson = call.getString("categoriesJson") else {
            call.reject("Missing categoriesJson")
            return
        }
        database.fetch(withRecordID: categoriesRecordID) { [weak self] existing, fetchError in
            guard let self = self else { return }
            if let fetchError = fetchError, (fetchError as? CKError)?.code != .unknownItem {
                call.reject("CloudKit fetch-before-save failed", nil, fetchError)
                return
            }
            let record = existing ?? CKRecord(recordType: self.categoriesRecordType, recordID: self.categoriesRecordID)
            record["categoriesJSON"] = categoriesJson as CKRecordValue
            self.database.save(record) { _, saveError in
                if let saveError = saveError {
                    call.reject("CloudKit save failed", nil, saveError)
                } else {
                    call.resolve()
                }
            }
        }
    }

    @objc func fetchCategories(_ call: CAPPluginCall) {
        database.fetch(withRecordID: categoriesRecordID) { record, error in
            if let error = error {
                if (error as? CKError)?.code == .unknownItem {
                    call.resolve(["categoriesJson": "[]"])
                } else {
                    call.reject("CloudKit fetch failed", nil, error)
                }
                return
            }
            let json = record?["categoriesJSON"] as? String ?? "[]"
            call.resolve(["categoriesJson": json])
        }
    }

    private static func jsonString(_ value: Any?) -> String? {
        guard let value = value,
              let data = try? JSONSerialization.data(withJSONObject: value) else { return "[]" }
        return String(data: data, encoding: .utf8)
    }

    private static func noteDict(from record: CKRecord) -> [String: Any] {
        let tagsJSON = record["tagsJSON"] as? String ?? "[]"
        let blocksJSON = record["blocksJSON"] as? String ?? "[]"
        return [
            "id": record.recordID.recordName,
            "title": record["title"] as? String ?? "",
            "tags": (try? JSONSerialization.jsonObject(with: Data(tagsJSON.utf8))) ?? [],
            "blocks": (try? JSONSerialization.jsonObject(with: Data(blocksJSON.utf8))) ?? [],
            "pinned": (record["pinned"] as? Int64 ?? 0) == 1,
            "archived": (record["archived"] as? Int64 ?? 0) == 1,
            "private": (record["private"] as? Int64 ?? 0) == 1,
            "updatedAt": record["updatedAt"] as? Double ?? 0,
        ]
    }
}
