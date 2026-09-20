package expo.modules.kotlin.types;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import com.facebook.react.bridge.Dynamic;
import com.facebook.react.bridge.DynamicFromObject;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import kotlin.jvm.JvmClassMappingKt;
import kotlin.reflect.KClass;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = {24, 34})
public class EnumTypeConverterTest {
  enum NameOnly implements Enumerable {
    ALPHA,
    BETA
  }

  enum IntValue implements Enumerable {
    LOW(1),
    HIGH(2);

    private final int value;

    IntValue(int value) {
      this.value = value;
    }
  }

  enum StringValue implements Enumerable {
    ADMIN("admin"),
    USER("user");

    private final String value;

    StringValue(String value) {
      this.value = value;
    }
  }

  enum TwoField implements Enumerable {
    PAIR(1, 2);

    private final int a;
    private final int b;

    TwoField(int a, int b) {
      this.a = a;
      this.b = b;
    }
  }

  @SuppressWarnings("unchecked")
  private static EnumTypeConverter converterFor(Class<? extends Enum<?>> cls) {
    KClass<?> kClass = JvmClassMappingKt.getKotlinClass(cls);
    return new EnumTypeConverter((KClass<Enum<?>>) kClass);
  }

  private static Dynamic dynamic(Object value) {
    return new DynamicFromObject(value);
  }

  @Test
  public void nameOnlyEnumConvertsByCaseName() {
    EnumTypeConverter converter = converterFor(NameOnly.class);
    assertEquals(NameOnly.ALPHA, converter.convertFromAny("ALPHA", null, false));
    assertEquals(NameOnly.BETA, converter.convertFromAny("BETA", null, false));
  }

  @Test
  public void nameOnlyEnumRejectsUnknownCaseName() {
    EnumTypeConverter converter = converterFor(NameOnly.class);
    try {
      converter.convertFromAny("NOPE", null, false);
      fail("expected unknown name to throw");
    } catch (Exception error) {
      assertTrue(error.getMessage(), error.getMessage().contains("NOPE"));
    }
  }

  @Test
  public void intValueEnumConvertsByUserField() {
    EnumTypeConverter converter = converterFor(IntValue.class);
    assertEquals(IntValue.LOW, converter.convertFromAny(1, null, false));
    assertEquals(IntValue.HIGH, converter.convertFromAny(2, null, false));
  }

  @Test
  public void intValueEnumAcceptsDoubleFromJsNumber() {
    EnumTypeConverter converter = converterFor(IntValue.class);
    assertEquals(IntValue.HIGH, converter.convertFromAny(2.0, null, false));
  }

  @Test
  public void stringValueEnumConvertsByUserField() {
    EnumTypeConverter converter = converterFor(StringValue.class);
    assertEquals(StringValue.ADMIN, converter.convertFromAny("admin", null, false));
    assertEquals(StringValue.USER, converter.convertFromAny("user", null, false));
  }

  @Test
  public void twoFieldEnumIsIncompatible() {
    EnumTypeConverter converter = converterFor(TwoField.class);
    try {
      converter.convertFromAny(1, null, false);
      fail("expected two-field enum to be incompatible");
    } catch (Exception error) {
      assertTrue(error.getMessage(), error.getMessage().contains("not compatible"));
    }
  }

  @Test
  public void nameOnlyEnumConvertsFromDynamicByCaseName() {
    EnumTypeConverter converter = converterFor(NameOnly.class);
    assertEquals(NameOnly.ALPHA, converter.convertFromDynamic(dynamic("ALPHA"), null, false));
    assertEquals(NameOnly.BETA, converter.convertFromDynamic(dynamic("BETA"), null, false));
  }

  @Test
  public void intValueEnumConvertsFromDynamicJsNumber() {
    EnumTypeConverter converter = converterFor(IntValue.class);
    assertEquals(IntValue.LOW, converter.convertFromDynamic(dynamic(1.0), null, false));
    assertEquals(IntValue.HIGH, converter.convertFromDynamic(dynamic(2.0), null, false));
  }

  @Test
  public void stringValueEnumConvertsFromDynamicByUserField() {
    EnumTypeConverter converter = converterFor(StringValue.class);
    assertEquals(StringValue.ADMIN, converter.convertFromDynamic(dynamic("admin"), null, false));
    assertEquals(StringValue.USER, converter.convertFromDynamic(dynamic("user"), null, false));
  }

  @Test
  public void twoFieldEnumIsIncompatibleFromDynamic() {
    EnumTypeConverter converter = converterFor(TwoField.class);
    try {
      converter.convertFromDynamic(dynamic(1.0), null, false);
      fail("expected two-field enum to be incompatible");
    } catch (Exception error) {
      assertTrue(error.getMessage(), error.getMessage().contains("not compatible"));
    }
  }

  @Test
  public void compiledConverterDoesNotUseKotlinReflectFull() throws Exception {
    byte[] bytes;
    try (InputStream in =
        EnumTypeConverter.class
            .getClassLoader()
            .getResourceAsStream("expo/modules/kotlin/types/EnumTypeConverter.class")) {
      assertNotNull(in);
      bytes = in.readAllBytes();
    }
    String haystack = new String(bytes, StandardCharsets.ISO_8859_1);
    assertFalse(haystack.contains("kotlin/reflect/full"));
    assertFalse(haystack.contains("fastPrimaryConstructor"));
    assertFalse(haystack.contains("KClassExtensions"));
  }
}
