﻿using System.Diagnostics;
using Colossal.Json;
using Colossal.UI.Binding;
using JetBrains.Annotations;

namespace HallOfFame.Domain;

[DebuggerDisplay("View(#{Id}) for Screenshot #{ScreenshotId}")]
[UsedImplicitly]
internal record View : IJsonWritable {
    [DecodeAlias("id")]
    internal string Id {
        get;
        [UsedImplicitly]
        set;
    } = "Unknown [Error]";

    [DecodeAlias("screenshotId")]
    internal string ScreenshotId {
        get;
        [UsedImplicitly]
        set;
    } = string.Empty;

    public void Write(IJsonWriter writer) {
        writer.TypeBegin(this.GetType().FullName);

        writer.PropertyName("id");
        writer.Write(this.Id);

        writer.PropertyName("screenshotId");
        writer.Write(this.ScreenshotId);

        writer.TypeEnd();
    }
}