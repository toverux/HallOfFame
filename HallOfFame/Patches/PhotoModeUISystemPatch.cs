using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection.Emit;
using Colossal.PSI.Common;
using Game.UI.InGame;
using HarmonyLib;

namespace HallOfFame.Patches;

/// <summary>
/// Patches <see cref="PhotoModeUISystem.CaptureScreenshot"/> to emit an event
/// when a screenshot is taken.
/// Is also capable of preventing the vanilla screenshot capture.
/// </summary>
internal static class PhotoModeUISystemPatch {
    /// <summary>
    /// Triggered when a screenshot should be taken.
    /// Return false to prevent vanilla screenshot capture.
    /// </summary>
    internal static event Func<bool> OnCaptureScreenshot = () => true;

    /// <summary>
    /// Explicit installation of Harmony patch from the outside.
    /// </summary>
    internal static void Install(Harmony harmony) {
        var photoModeUISystemCaptureScreenshotMethod =
            // The method is an enumerator using yield, meaning it gets
            // compiled into a dynamically-generated inner state-machine class
            // where the actual CaptureScreenshot() method body lives.
            // Fortunately, Harmony has this handy helper method to get the
            // actual method, that is the MoveNext().
            AccessTools.EnumeratorMoveNext(
                AccessTools.Method(typeof(PhotoModeUISystem), "CaptureScreenshot"));

        harmony.Patch(
            photoModeUISystemCaptureScreenshotMethod,
            transpiler: new HarmonyMethod(
                typeof(PhotoModeUISystemPatch),
                nameof(PhotoModeUISystemPatch.PatchCaptureScreenshot)));
    }

    /// <summary>
    /// Harmony transpiler patching <see cref="PhotoModeUISystem.CaptureScreenshot"/>.
    /// </summary>
    private static IEnumerable<CodeInstruction> PatchCaptureScreenshot(
        IEnumerable<CodeInstruction> enumerableInstructions,
        ILGenerator ilGenerator) {
        // First, convert the enumerable to a list, it will be a bit more
        // practical to read and manipulate the list than `yield`ing instructions.
        var instructions = enumerableInstructions.ToList();

        // Seek for `PlatformManager.instance.TakeScreenshot();`...
        var takeScreenshotMethod = AccessTools.PropertyGetter(
            typeof(PlatformManager), nameof(PlatformManager.instance));

        var vanillaCaptureIndex = instructions
            .FindIndex(instruction => instruction.Calls(takeScreenshotMethod));

        // Check this is the correct sequence of instructions:
        //  - `call` for `PlatformManager::get_instance()`,
        //  - `callvirt` for `PlatformManager::TakeScreenshot()`,
        //  - `pop` to remove its string return (file path) from the stack.
        // If not, bail out.
        if (vanillaCaptureIndex <= 0 ||
            instructions[vanillaCaptureIndex + 1].opcode != OpCodes.Callvirt ||
            instructions[vanillaCaptureIndex + 2].opcode != OpCodes.Pop) {
            throw new Exception("Could not find injection point.");
        }

        // Create a label to the instruction just after the vanilla screenshot
        // capture, to jump to it if the vanilla capture is inhibited.
        var continueLabel = ilGenerator.DefineLabel();
        instructions[vanillaCaptureIndex + 3].labels.Add(continueLabel);

        // Call the event handler so a subscriber can take its own screenshot.
        // The return value is used to determine whether to execute the vanilla
        // screenshot capture, otherwise we skip that code.
        instructions.InsertRange(vanillaCaptureIndex, new[] {
            // Load event handler Action on stack.
            new CodeInstruction(
                OpCodes.Ldsfld,
                AccessTools.Field(
                    typeof(PhotoModeUISystemPatch),
                    nameof(PhotoModeUISystemPatch.OnCaptureScreenshot))),
            // Call Invoke on it.
            new CodeInstruction(
                OpCodes.Callvirt,
                AccessTools.Method(
                    typeof(Func<bool>), nameof(Func<bool>.Invoke))),
            // If the return value is false, jump to the instruction after
            // the vanilla screenshot capture.
            // Also, pops the Action return value.
            new CodeInstruction(OpCodes.Brfalse_S, continueLabel)
        });

        return instructions;
    }
}
