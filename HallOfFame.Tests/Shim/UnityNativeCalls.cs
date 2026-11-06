using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Runtime.Loader;
using Mono.Cecil;
using Mono.Cecil.Cil;
using MethodBody = Mono.Cecil.Cil.MethodBody;

namespace HallOfFame.Tests.Shim;

/// <summary>
/// <para>
/// Managed stand-ins for the Unity player's native calls that Unity.Collections allocates and
/// copies memory with, so the tests can use NativeArray, NativeList, hash maps, and queues with
/// real allocators.
/// </para>
/// <para>
/// CoreCLR refuses an InternalCall method outside its own System.Private.CoreLib ("ECall methods
/// must be packaged into a system module"), so the build leaves UnityEngine.CoreModule out of the
/// app's dependencies and copies it as <c>UnityEngine.CoreModule.original</c> (see the test
/// csproj).
/// The default load context then asks the handler registered here for it, which loads an in-memory
/// copy where each extern listed in <see cref="Externs"/> gets an IL body calling the method of the
/// same name below.
/// Every other extern still throws when called: add it to the list, with its replacement, when a
/// test needs it.
/// </para>
/// <para>
/// The replacements take an <c>int</c> where the extern takes an <c>Allocator</c>, which is the
/// same on the evaluation stack: a parameter typed with a UnityEngine.CoreModule type would make
/// the reflection lookup below load the very assembly it is building.
/// </para>
/// <para>
/// Public, with public replacements: the patched UnityEngine.CoreModule calls them from outside
/// this assembly.
/// </para>
/// </summary>
public static unsafe class UnityNativeCalls {
  private const string CoreModuleName = "UnityEngine.CoreModule";

  private const string UnsafeUtility = "Unity.Collections.LowLevel.Unsafe.UnsafeUtility";

  private const string JobsUtility = "Unity.Jobs.LowLevel.Unsafe.JobsUtility";

  /// <summary>
  /// The redirected externs, by declaring type and method name.
  /// </summary>
  private static readonly (string Type, string Method)[] Externs = [
    (UnityNativeCalls.UnsafeUtility, nameof(UnityNativeCalls.MallocTracked)),
    (UnityNativeCalls.UnsafeUtility, nameof(UnityNativeCalls.Malloc)),
    (UnityNativeCalls.UnsafeUtility, nameof(UnityNativeCalls.FreeTracked)),
    (UnityNativeCalls.UnsafeUtility, nameof(UnityNativeCalls.Free)),
    (UnityNativeCalls.UnsafeUtility, nameof(UnityNativeCalls.MemCpy)),
    (UnityNativeCalls.UnsafeUtility, nameof(UnityNativeCalls.MemMove)),
    (UnityNativeCalls.UnsafeUtility, nameof(UnityNativeCalls.MemSet)),
    (UnityNativeCalls.UnsafeUtility, nameof(UnityNativeCalls.MemCmp)),
    (UnityNativeCalls.JobsUtility, nameof(UnityNativeCalls.get_ThreadIndex)),
    (UnityNativeCalls.JobsUtility, nameof(UnityNativeCalls.get_ThreadIndexCount)),
    (UnityNativeCalls.JobsUtility, nameof(UnityNativeCalls.get_JobWorkerMaximumCount)),
    (UnityNativeCalls.JobsUtility, nameof(UnityNativeCalls.get_IsExecutingJob))
  ];

  /// <summary>
  /// The patched copy, built once: test classes run in parallel, and two of them can reach
  /// UnityEngine.CoreModule first at the same time.
  /// </summary>
  private static readonly Lazy<Assembly> PatchedCoreModule =
    new(UnityNativeCalls.LoadPatchedCoreModule);

  public static void*
    MallocTracked(long size, int alignment, int allocator, int callstacksToSkip) =>
    UnityNativeCalls.Malloc(size, alignment, allocator);

  public static void* Malloc(long size, int alignment, int allocator) =>
    NativeMemory.AlignedAlloc((nuint) Math.Max(size, 1), (nuint) Math.Max(alignment, 1));

  public static void FreeTracked(void* memory, int allocator) =>
    UnityNativeCalls.Free(memory, allocator);

  public static void Free(void* memory, int allocator) => NativeMemory.AlignedFree(memory);

  public static void MemCpy(void* destination, void* source, long size) =>
    UnityNativeCalls.MemMove(destination, source, size);

  // Buffer.MemoryCopy handles overlapping ranges.
  public static void MemMove(void* destination, void* source, long size) =>
    Buffer.MemoryCopy(source, destination, size, size);

  public static void MemSet(void* destination, byte value, long size) =>
    NativeMemory.Fill(destination, (nuint) size, value);

  public static int MemCmp(void* ptr1, void* ptr2, long size) =>
    new ReadOnlySpan<byte>(ptr1, checked((int) size))
      .SequenceCompareTo(new ReadOnlySpan<byte>(ptr2, checked((int) size)));

  // The tests run outside any job, on what Unity would call the main thread.
  public static int get_ThreadIndex() => 0;

  public static int get_ThreadIndexCount() => 128;

  public static int get_JobWorkerMaximumCount() => 127;

  public static bool get_IsExecutingJob() => false;

  [ModuleInitializer]
  internal static void Register() =>
    AssemblyLoadContext.Default.Resolving += static (_, name) =>
      name.Name is UnityNativeCalls.CoreModuleName
        ? UnityNativeCalls.PatchedCoreModule.Value
        : null;

  private static Assembly LoadPatchedCoreModule() {
    var path = Path.Combine(
      AppContext.BaseDirectory,
      $"{UnityNativeCalls.CoreModuleName}.original"
    );

    using var module = ModuleDefinition.ReadModule(path);

    foreach (var (typeName, methodName) in UnityNativeCalls.Externs) {
      // Each entry of Externs names a method of this class by nameof: the lookup always finds it.
      var managed = typeof(UnityNativeCalls).GetMethod(
        methodName,
        BindingFlags.Public | BindingFlags.Static
      )!;

      var parameterCount = managed.GetParameters().Length;

      var method = module
        .GetType(typeName)
        .Methods
        .Single(candidate =>
          candidate.Name == methodName &&
          candidate.IsInternalCall &&
          candidate.Parameters.Count == parameterCount
        );

      method.IsInternalCall = false;
      method.IsIL = true;
      method.IsManaged = true;
      method.Body = new MethodBody(method);

      var il = method.Body.GetILProcessor();

      foreach (var parameter in method.Parameters) {
        il.Emit(OpCodes.Ldarg, parameter);
      }

      il.Emit(OpCodes.Call, module.ImportReference(managed));
      il.Emit(OpCodes.Ret);
    }

    var image = new MemoryStream();

    module.Write(image);

    image.Position = 0;

    return AssemblyLoadContext.Default.LoadFromStream(image);
  }
}
