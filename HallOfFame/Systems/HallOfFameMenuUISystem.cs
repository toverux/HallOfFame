using System;
using Colossal.UI.Binding;
using Game.UI;
using HallOfFame.Utils;

namespace HallOfFame.Systems;

/// <summary>
/// System responsible for handling the Hall of Fame UI on the game's main menu.
/// </summary>
public sealed partial class HallOfFameMenuUISystem : UISystemBase {
    private const string BindingGroup = "hallOfFame.menu";

    private const string VanillaDefaultImageUri = "Media/Menu/Background2.jpg";

    protected override void OnCreate() {
        base.OnCreate();

        try {
            this.AddBinding(new ValueBinding<string>(
                HallOfFameMenuUISystem.BindingGroup, "currentImageUri",
                HallOfFameMenuUISystem.VanillaDefaultImageUri));

            this.AddBinding(new ValueBinding<CityInfo?>(
                HallOfFameMenuUISystem.BindingGroup, "currentImageCity",
                new CityInfo {
                    Name = "Colossal City",
                    CreatorName = "Toverux",
                    Milestone = 20,
                    Population = 20000,
                    PostedAt = DateTime.Now
                },
                new ValueWriter<CityInfo?>().Nullable()));
        }
        catch (Exception ex) {
            Mod.Log.ErrorFatal(ex);
        }
    }

    private sealed class CityInfo : IJsonWritable {
        public string Name { get; set; } = "";

        public string CreatorName { get; set; } = "";

        public int Milestone { get; set; }

        public int Population { get; set; }

        public DateTime PostedAt { get; set; }

        public void Write(IJsonWriter writer) {
            writer.TypeBegin(this.GetType().FullName);

            writer.PropertyName("name");
            writer.Write(this.Name);

            writer.PropertyName("creatorName");
            writer.Write(this.CreatorName);

            writer.PropertyName("milestone");
            writer.Write(this.Milestone);

            writer.PropertyName("population");
            writer.Write(this.Population);

            writer.PropertyName("postedAt");
            writer.Write(this.PostedAt.ToLocalTime().ToString("o"));

            writer.TypeEnd();
        }
    }
}
