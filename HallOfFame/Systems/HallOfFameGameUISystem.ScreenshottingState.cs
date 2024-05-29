using Colossal.UI.Binding;
using UnityEngine;

namespace HallOfFame.Systems;

/// <summary>
/// Partial class just for isolating <see cref="ScreenshottingState"/> class and
/// its subclasses for use by the same System.
/// </summary>
public partial class HallOfFameGameUISystem {
    public abstract class ScreenshottingState : IJsonWritable {
        /// <summary>
        /// Serialized type-discriminator key for the UI.
        /// </summary>
        protected abstract string Name { get; }

        /// <summary>
        /// For resolving the type name just once.
        /// </summary>
        private readonly string typeName;

        protected ScreenshottingState() {
            this.typeName = this.GetType().FullName!;
        }

        public void Write(IJsonWriter writer) {
            // The type name MUST be different for different object shapes
            // (inheriting classes), otherwise there is a crash to desktop
            // without a single line of log.
            writer.TypeBegin(this.typeName);

            writer.PropertyName("name");
            writer.Write(this.Name);

            this.WriteOwn(writer);

            writer.TypeEnd();
        }

        protected virtual void WriteOwn(IJsonWriter writer) {
        }
    }

    public sealed class ScreenshottingStateIdle : ScreenshottingState {
        protected override string Name => "idle";
    }

    public sealed class ScreenshottingStateTaking : ScreenshottingState {
        protected override string Name => "taking";
    }

    public sealed class ScreenshottingStateReady(
        byte[] imageBytes,
        Vector2Int imageSize) : ScreenshottingState {
        protected override string Name => "ready";

        public byte[] ImageBytes { get; } = imageBytes;

        public Vector2Int ImageSize { get; } = imageSize;

        /// <summary>
        /// As we use the same file name for each new screenshot, this is a
        /// refresh counter appended to the URL of the image as a query
        /// parameter for cache busting.
        /// </summary>
        private static int latestVersion;

        private readonly int currentVersion =
            ScreenshottingStateReady.latestVersion++;

        protected override void WriteOwn(IJsonWriter writer) {
            writer.PropertyName("uri");
            writer.Write($"coui://halloffame/screenshot.jpg?v={this.currentVersion}");

            writer.PropertyName("width");
            writer.Write(this.ImageSize.x);

            writer.PropertyName("height");
            writer.Write(this.ImageSize.y);

            writer.PropertyName("fileSize");
            writer.Write(this.ImageBytes.Length);
        }
    }

    public sealed class ScreenshottingStateUploading : ScreenshottingState {
        protected override string Name => "uploading";
    }

    public sealed class ScreenshottingStateUploaded : ScreenshottingState {
        protected override string Name => "uploaded";
    }
}
