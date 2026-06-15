package com.example.expensemanager.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun PinInput(
    value: String,
    onValueChange: (String) -> Unit,
    length: Int = 4,
    isError: Boolean = false
) {
    BasicTextField(
        value = value,
        onValueChange = {
            if (it.length <= length && it.all { char -> char.isDigit() }) {
                onValueChange(it)
            }
        },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
        decorationBox = {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally),
                verticalAlignment = Alignment.CenterVertically
            ) {
                repeat(length) { index ->
                    val char = when {
                        index >= value.length -> ""
                        else -> "●"
                    }
                    val isFocused = value.length == index
                    
                    Box(
                        modifier = Modifier
                            .size(50.dp)
                            .border(
                                width = if (isFocused) 2.dp else 1.dp,
                                color = when {
                                    isError -> MaterialTheme.colorScheme.error
                                    isFocused -> MaterialTheme.colorScheme.primary
                                    else -> MaterialTheme.colorScheme.outline
                                },
                                shape = RoundedCornerShape(12.dp)
                            )
                            .background(
                                color = if (isFocused) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f) 
                                        else MaterialTheme.colorScheme.surface,
                                shape = RoundedCornerShape(12.dp)
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = char,
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                            color = if (isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            }
        }
    )
}
