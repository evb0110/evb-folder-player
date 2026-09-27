package com.evb.folderaudio
import org.junit.Assert.*
import org.junit.Test
class NaturalOrderTest {
  @Test fun filenamesFollowNumericChapterOrder() {
    assertEquals(listOf("01.mp3", "2.mp3", "10.mp3"), listOf("10.mp3", "2.mp3", "01.mp3").sortedWith(NaturalOrder))
    assertTrue(NaturalOrder.compare("9007199254740992", "9007199254740993") < 0)
    assertTrue(NaturalOrder.compare("Book 2 Chapter 9", "Book 10 Chapter 1") < 0)
  }
}
