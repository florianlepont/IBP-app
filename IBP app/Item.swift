//
//  Item.swift
//  IBP app
//
//  Created by Florian Lepont on 04/03/2026.
//

import Foundation
import SwiftData

@Model
final class Item {
    var timestamp: Date
    
    init(timestamp: Date) {
        self.timestamp = timestamp
    }
}
